-- LikeWise initial schema (see docs/PLAN.md, "Data model").
-- Writes to shared tables (places, reviews, summaries, results, ledger) happen
-- server-side with the service role, which bypasses RLS. Policies below only
-- grant what browsers may read or write directly.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.review_source as enum ('google', 'tripadvisor', 'reddit', 'likewise');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.search_status as enum (
  'queued', 'understanding', 'discovering', 'fetching', 'scoring', 'complete', 'failed'
);
create type public.result_status as enum ('candidate', 'early', 'scored', 'summarized');
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.feedback_kind as enum ('review_like_me', 'summary_helpful');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ui_lang text not null default 'he' check (ui_lang in ('he', 'en')),
  is_guest boolean not null default false,
  guest_searches_used integer not null default 0 check (guest_searches_used >= 0),
  -- Personas can reveal religion (kosher, Shabbat), nationality and children:
  -- we ask for explicit consent before saving the first one.
  sensitive_data_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every auth user (including anonymous guests) gets a profile.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, is_guest)
  values (new.id, coalesce(new.is_anonymous, false));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A guest who signs up keeps their user id; clear the guest flag.
create function public.handle_user_upgraded() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set is_guest = coalesce(new.is_anonymous, false)
  where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_upgraded after update of is_anonymous on auth.users
  for each row when (old.is_anonymous is distinct from new.is_anonymous)
  execute function public.handle_user_upgraded();

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  raw_text text not null check (char_length(raw_text) between 1 and 500),
  parsed jsonb not null,
  persona_key text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personas_user_idx on public.personas (user_id);
create unique index personas_one_default_idx on public.personas (user_id) where is_default;
create trigger personas_updated_at before update on public.personas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Places and reviews
-- ---------------------------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_local text,
  -- Google's terms allow caching coordinates for up to 30 days; the refresh
  -- job re-fetches them along with reviews.
  location extensions.geography (point, 4326) not null,
  categories text[] not null default '{}',
  google_place_id text unique,
  tripadvisor_location_id text unique,
  -- Per-source overall rating, e.g. {"google": {"rating": 4.4, "count": 1210}}.
  ratings jsonb not null default '{}',
  -- Bumped whenever the review corpus changes; invalidates cached summaries.
  corpus_version integer not null default 0,
  reviews_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_location_idx on public.places using gist (location);
create index places_name_trgm_idx on public.places using gin (name_en extensions.gin_trgm_ops);
create trigger places_updated_at before update on public.places
  for each row execute function public.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  source public.review_source not null,
  source_review_id text not null,
  -- Source-provided reviewer info, e.g. TripAdvisor trip_type and hometown.
  author_meta jsonb not null default '{}',
  rating numeric(2, 1) check (rating between 1 and 5),
  -- True when the rating was inferred from text (e.g. Reddit comments).
  rating_inferred boolean not null default false,
  title text,
  body text not null,
  lang text,
  published_at timestamptz,
  visited_at date,
  url text,
  -- In-app (source = 'likewise') reviews only.
  author_user_id uuid references auth.users (id) on delete cascade,
  author_persona jsonb,
  moderation_status public.moderation_status not null default 'approved',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_review_id),
  check ((source = 'likewise') = (author_user_id is not null))
);

create index reviews_place_published_idx on public.reviews (place_id, published_at desc);
create unique index reviews_one_per_user_place_idx on public.reviews (place_id, author_user_id)
  where source = 'likewise';
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- Reviewer persona inferred by the AI. Versioned so improved prompts can
-- re-process reviews without losing the previous output.
create table public.review_personas (
  review_id uuid not null references public.reviews (id) on delete cascade,
  extractor_version text not null,
  persona jsonb not null,
  evidence text,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (review_id, extractor_version)
);

create table public.review_translations (
  review_id uuid not null references public.reviews (id) on delete cascade,
  lang text not null,
  body text not null,
  created_at timestamptz not null default now(),
  primary key (review_id, lang)
);

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Searches, results and summaries
-- ---------------------------------------------------------------------------

create table public.place_summaries (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  persona_key text not null,
  intent_key text not null,
  window_months integer not null,
  lang text not null,
  -- {oneLiner, pros[], cons[], tips[], citedReviewIds[]}
  content jsonb not null,
  review_ids uuid[] not null default '{}',
  corpus_version integer not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (place_id, persona_key, intent_key, window_months, lang)
);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  persona_id uuid references public.personas (id) on delete set null,
  persona_text text not null,
  persona_parsed jsonb,
  persona_key text,
  target_text text not null,
  intent jsonb,
  center extensions.geography (point, 4326),
  center_label text,
  radius_km numeric(6, 2),
  window_months integer not null default 24 check (window_months in (6, 12, 24, 36, 60)),
  trip_month integer check (trip_month between 1 and 12),
  ui_lang text not null default 'he',
  status public.search_status not null default 'queued',
  error text,
  -- Similar searches (same area cell, intent, persona key, window, trip
  -- month) reuse each other's results.
  cache_key text,
  share_slug text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index searches_user_created_idx on public.searches (user_id, created_at desc);
create index searches_cache_key_idx on public.searches (cache_key, created_at desc)
  where status = 'complete';

create table public.search_results (
  search_id uuid not null references public.searches (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  rank integer,
  like_me_rating numeric(3, 2),
  like_me_n_eff numeric(8, 2),
  like_me_confidence public.confidence_level,
  overall_rating numeric(3, 2),
  overall_count integer,
  distance_km numeric(7, 2),
  summary_id uuid references public.place_summaries (id) on delete set null,
  status public.result_status not null default 'candidate',
  updated_at timestamptz not null default now(),
  primary key (search_id, place_id)
);

create trigger search_results_updated_at before update on public.search_results
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- User actions
-- ---------------------------------------------------------------------------

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  review_id uuid references public.reviews (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  kind public.feedback_kind not null,
  value boolean not null,
  created_at timestamptz not null default now(),
  check (review_id is not null or place_id is not null),
  unique nulls not distinct (user_id, kind, search_id, review_id, place_id)
);

-- ---------------------------------------------------------------------------
-- Server-only bookkeeping (no RLS policies: service role only)
-- ---------------------------------------------------------------------------

-- Parsed persona/intent texts and other deterministic AI results.
create table public.ai_cache (
  key text primary key,
  kind text not null,
  value jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

-- Every paid API call, for the $300/month budget guard and the admin view.
create table public.usage_ledger (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  search_id uuid references public.searches (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  provider text not null,
  operation text not null,
  units integer,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10, 6) not null default 0,
  meta jsonb not null default '{}'
);

create index usage_ledger_created_idx on public.usage_ledger (created_at);

-- Per-IP guest search counts (IP is stored hashed).
create table public.guest_rate_limits (
  ip_hash text not null,
  day date not null,
  searches integer not null default 0,
  primary key (ip_hash, day)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.personas enable row level security;
alter table public.places enable row level security;
alter table public.reviews enable row level security;
alter table public.review_personas enable row level security;
alter table public.review_translations enable row level security;
alter table public.review_reports enable row level security;
alter table public.place_summaries enable row level security;
alter table public.searches enable row level security;
alter table public.search_results enable row level security;
alter table public.favorites enable row level security;
alter table public.match_feedback enable row level security;
alter table public.ai_cache enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.guest_rate_limits enable row level security;

-- Profiles: own row only. Guest counters are changed server-side.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Personas: full control over own personas.
create policy "personas: read own" on public.personas
  for select to authenticated using (user_id = (select auth.uid()));
create policy "personas: insert own" on public.personas
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "personas: update own" on public.personas
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "personas: delete own" on public.personas
  for delete to authenticated using (user_id = (select auth.uid()));

-- Public catalog data: readable by everyone.
create policy "places: public read" on public.places
  for select to anon, authenticated using (true);
create policy "reviews: public read approved, authors read own" on public.reviews
  for select to anon, authenticated
  using (moderation_status = 'approved' or author_user_id = (select auth.uid()));
create policy "review_personas: public read" on public.review_personas
  for select to anon, authenticated using (true);
create policy "review_translations: public read" on public.review_translations
  for select to anon, authenticated using (true);
create policy "place_summaries: public read" on public.place_summaries
  for select to anon, authenticated using (true);

-- Reports: users may file and see their own reports.
create policy "review_reports: insert own" on public.review_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "review_reports: read own" on public.review_reports
  for select to authenticated using (user_id = (select auth.uid()));

-- Searches and their results: owner only (shared links are served server-side).
create policy "searches: read own" on public.searches
  for select to authenticated using (user_id = (select auth.uid()));
create policy "searches: delete own" on public.searches
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "search_results: read own" on public.search_results
  for select to authenticated
  using (exists (
    select 1 from public.searches s
    where s.id = search_id and s.user_id = (select auth.uid())
  ));

-- Favorites and feedback: own rows only.
create policy "favorites: read own" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorites: insert own" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorites: delete own" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "match_feedback: read own" on public.match_feedback
  for select to authenticated using (user_id = (select auth.uid()));
create policy "match_feedback: insert own" on public.match_feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "match_feedback: update own" on public.match_feedback
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Table privileges (least privilege; RLS above still applies on top).
-- Stated explicitly rather than relying on Supabase's default grants.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Only these profile columns are user-editable; guest counters are not.
grant select on public.profiles to authenticated;
grant update (ui_lang, sensitive_data_consent_at) on public.profiles to authenticated;

grant select, insert, update, delete on public.personas to authenticated;
grant select on public.places, public.reviews, public.review_personas,
  public.review_translations, public.place_summaries to anon, authenticated;
grant select, insert on public.review_reports to authenticated;
grant select, delete on public.searches to authenticated;
grant select on public.search_results to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update on public.match_feedback to authenticated;
-- ai_cache, usage_ledger, guest_rate_limits: no browser access at all.

-- ---------------------------------------------------------------------------
-- Realtime: results stream into the results page as they are scored.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.searches, public.search_results;
