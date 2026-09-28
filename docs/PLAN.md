# LikeWise (working title): reviews from people like you

## Context

Review platforms mix everyone's opinions together. A family with four toddlers, a couple of friends in their 20s, and an Israeli dad with his son all see the same average rating. But they value different things (stroller access vs. nightlife vs. kosher options). LikeWise lets a user describe **who they are right now** and **what they're looking for** in free text, around their location or a chosen place. It then gathers reviews from multiple platforms and brings forward the ones written by **people like them**, with a "like-me" rating, pros and cons, and practical tips.

The repo (`talserphos/like-wise`) is empty, so this is a new build. All work goes on branch `claude/location-reviews-similar-users-6s1tx9`. Goal: a **prototype to validate the idea** with a small group of testers (Israel plus Europe trips). Claude builds it end-to-end in phases, and the user reviews each phase and supplies API keys.

## Confirmed vision (from Q&A)

| Topic | Decision |
|---|---|
| Form | Installable web app (PWA), mobile-first |
| Ambition | Prototype to validate the idea |
| Persona input | **Free text** ("family with 4 little kids, Israelis"), shown back as **removable "understood as" chips** |
| Target input | **Free text** ("easy trail with water", "museum good for toddlers") |
| Use moments | Both "near me now" and "planning a trip ahead" |
| Location | GPS, a searched city, or a map pin. **Smart radius** by category, with a slider to override |
| Time window | Default last **2 years**, adjustable (6 mo/1/2/3/5 yr). **Newer reviews count more**. **Same-season boost** where season matters. Trip date comes from the text ("in August"), else an optional "When?" field (default today) |
| Sources v1 | Google Maps + TripAdvisor (official APIs + paid vendor), Reddit (once API access is approved). Facebook **later**, with an adapter slot ready now |
| Matching | Similarity score. **Two tabs: "Like me" / "Everyone else"**. Nationality = same country + same language + shared cultural needs, all combined into one score. **No inferring from names** |
| Results | Places ranked, each with a summary: like-me rating vs overall, pros/cons for people like me, practical tips, confidence indicator. Option to **drill into a full review feed** |
| Speed | Progressive: places appear in ~5 s, like-me scores/summaries stream in. **Results cached and reused by similar users** |
| Languages | Hebrew (RTL) + English UI. Reviews in any language are translated, with "show original" |
| Accounts | Google sign-in + email **magic link / 6-digit code**. Guests get **2 free searches**, then sign up |
| v1 features | Saved personas, search history & favorites, share results, "is this really like me?" feedback |
| In-app reviews | **Yes in v1**, shown mixed with the others with a LikeWise badge. Author shown as **persona only, no name** |
| AI models | Starting mix: **Claude Haiku 4.5** for bulk review reading (`claude-haiku-4-5`), **Claude Sonnet 5** for query understanding and summaries (`claude-sonnet-5`). **Final choice is made with data in Phase 2**: a side-by-side comparison on the labeled eval set (accuracy + real cost), and the user picks |
| Budget | Data + AI **monthly cap $300** (confirmed). Headroom above the ~$80–110 baseline can go to stronger models if the Phase 2 comparison shows it's worth it. Hosting uses free tiers at first |
| Validation | Repeat usage + match-quality feedback. Deeper KPIs to be designed once running |
| Stack | Next.js (TypeScript) + Supabase + Vercel + Inngest + Claude (my pick; user had no preference) |

## Data sources: what's realistic

| Source | Access | What we get | Notes |
|---|---|---|---|
| Google Places API (New) | Official | Place discovery (Text Search), details, **max 5 reviews/place** | Free monthly caps per SKU (Pro 5K, Enterprise 1K calls). Only `place_id` may be stored long-term (lat/lng ≤30 days). Places shown on a map must use a Google map |
| TripAdvisor Content API | Official | Location search/nearby, details, **5 most recent reviews/place with `trip_type`** (Family/Couples/Solo/Business/Friends) and reviewer location | Free tier, then pay-as-you-go. Attribution/logo/link-back rules apply |
| DataForSEO Reviews API (primary vendor) | Paid vendor | Deep Google + TripAdvisor reviews, newest first | ~$0.075–0.15 per 1,000 reviews (standard/priority queue). Async task model, so **latency must be measured in Phase 1**. **ToS gray area**: acceptable for a prototype, needs legal review before public launch |
| Apify review actors (fallback vendor) | Paid vendor | Same | ~$0.25–0.50 per 1,000 reviews. Can run synchronously (faster) |
| Reddit Data API | Official, **approval required** | First-person threads/comments ("went with our 3 toddlers…") | Responsible Builder Policy: approval takes 2–4 weeks, **so apply on day 1**. Free for non-commercial use at 100 QPM. Commercial use later needs a paid agreement |
| LikeWise in-app reviews | Own | Reviews with an **exactly known persona** | Our long-term unique asset |
| Facebook | none | none | Not in v1. The `SourceAdapter` interface keeps a slot |

Hiking trails come from Google (`hiking_area`, parks) and TripAdvisor attractions in v1. AllTrails has no API.

## Architecture

```
 PWA (Next.js App Router, he/en, RTL)          Supabase
  ├─ search / results / place / me   ◄──realtime── Postgres + PostGIS (places, reviews, personas,
  │                                                 searches, results, summaries, ledger), Auth
  ▼
 Next.js route handlers (Vercel) ── enqueue ──► Inngest "run-search" job (durable, retries, fan-out per place)
                                                 ├─ Google Places API (New) · Maps JS · Geocoding
                                                 ├─ TripAdvisor Content API
                                                 ├─ DataForSEO (Apify fallback) deep reviews
                                                 ├─ Reddit Data API (Phase 6)
                                                 └─ Claude API: Haiku 4.5 (extract/translate/moderate)
                                                                Sonnet 5 (parse query, summarize)
```

- **Frontend:** Next.js 15+ (App Router, TypeScript), Tailwind (logical properties for RTL), `next-intl` (he/en), Serwist for PWA/service worker, Google Maps JS (Advanced Markers), PostHog for analytics.
- **Backend:** Next.js route handlers plus **Inngest** for the long multi-step search job. Vendor calls take 30–90 s, which is too long for one serverless request, and Inngest gives retries, per-source concurrency limits, and a nightly pre-warm cron. Results are written row by row to Postgres, and the client gets live updates via **Supabase Realtime**.
- **DB:** Supabase Postgres + PostGIS (radius queries), plus pg_trgm for place dedupe.
- **Auth:** Supabase Auth with Google OAuth + email OTP (magic link **and** 6-digit code; the code matters because magic links open in the browser, not the installed PWA). **Anonymous sign-in** for guests, upgraded in place on signup so their history is kept.
- **Email:** Resend (free tier) as Supabase SMTP. The default Supabase SMTP is heavily rate-limited.

## Search pipeline (one search)

1. **Understand** (Sonnet 5, ~1–2 s, cached by text hash). Free-text persona → `PersonaProfile`. Target text → `SearchIntent` = {search queries in local language + English, Google place types, TripAdvisor category, `radiusKm` default, `seasonSensitive`, `tripMonth?`, must-haves like "shaded" or "stroller access"}.
2. **Locate:** GPS, or geocode the city/pin. Smart radius defaults: food ~3 km, attractions/museums ~15 km, hiking/nature ~40 km. Slider override. Auto-expand once if fewer than 5 candidates.
3. **Discover candidates** (~2–4 s): Google Text Search (location-restricted) + TripAdvisor nearby/search, run in parallel. **Dedupe** by distance <150 m + trigram name similarity (English names requested for matching; localized names kept for display). Rank by relevance/rating/count and keep the top ~12. **Candidates render immediately** with overall ratings.
4. **Early signal** (~5–15 s): fetch the official 5 Google + 5 TripAdvisor reviews per place and extract personas. TripAdvisor `trip_type` and reviewer location map straight to persona fields. Shows first "like-me" hints.
5. **Deep fetch** (~15–90 s, per place in parallel): if the place's stored review corpus is older than 30 days (or missing), the vendor fetches the newest reviews within the window (default depth: up to **80 Google + 40 TripAdvisor** per place, stopping at already-known review IDs).
6. **Extract** (Haiku 4.5): batches of ~20 reviews per call → reviewer `PersonaProfile` + visit month + short evidence quote. Stored per review with an `extractor_version`, so the prompt can be improved and reviews re-processed.
7. **Score and aggregate** (deterministic TypeScript, see below) → like-me rating, confidence, tab split, place ranking.
8. **Summarize** (Sonnet 5, low effort): top ~15 matched reviews + persona + intent → `{oneLiner, pros[], cons[], tips[], citedReviewIds[]}` in the UI language. Streamed into the result card.
9. **Cache:** search results for 24 h keyed by (geo cell, intent key, **persona key**, window, trip-month bucket). Summaries keyed by (place, persona key, intent key, window, lang). **Similar users reuse both.**

Nightly Inngest cron: **pre-warm** popular areas from search history (top Israel spots + common Israeli-traveler Europe destinations). It uses the **Message Batches API (50% cheaper)** because no one is waiting.

## AI design (Claude)

- SDK `@anthropic-ai/sdk`. Structured outputs via `client.messages.parse()` + `zodOutputFormat(schema)` (`output_config.format`). Zod schemas in `lib/ai/schemas.ts` are shared by the AI layer and the app. Verify Haiku 4.5 structured-output support in Phase 2; fall back to strict tool use (`strict: true`) if it isn't supported.
- **Prompt caching:** a frozen system prompt (instructions + schema + few-shot HE/EN examples) comes first with `cache_control`, and the variable review batch comes last. Haiku's minimum cacheable prefix is large, so the few-shot block must reach it. Verify with `usage.cache_read_input_tokens`.
- Models are **configured per task** in `lib/ai/models.ts`. Sonnet 5 uses adaptive thinking at `effort: "low"`. Haiku 4.5 runs without thinking.

| Task | Model | Volume |
|---|---|---|
| `parseSearch` (persona + intent) | Sonnet 5 | 1 per new search text |
| `extractReviewPersonas` | Haiku 4.5 (Batches API for pre-warm) | Every new review |
| `summarizePlace` | Sonnet 5 | Per (place, persona key) cache miss |
| `translateReview` | Haiku 4.5 | On demand, only reviews on screen, cached |
| `moderateUserReview` | Haiku 4.5 | Each in-app review |
| Reddit mention extraction | Haiku 4.5 | Phase 6 |

**`PersonaProfile` schema** (same shape for users and reviewers; each field carries `confidence` 0–1 and optional `evidence`):
- `party`: family | couple | friends | solo | parent_child | multigen | business | unknown, plus adult count
- `children`: array of {ageBand: infant | toddler | child | preteen | teen, count}
- `background`: `originCountry` (ISO-2), `languages` (review language counts for reviewers), `culturalNeeds` (kosher, shabbat, halal, vegetarian, hebrew_speaking…)
- `access`: stroller, wheelchair, limited_mobility, dog
- `lifeStage`: young_adult | adult | senior
- `tags`: free interests ("loves trains")
- reviewer only: `visitMonth` (TripAdvisor travel date → text mention → publish month)

## Matching & scoring (`lib/matching/`)

- **Similarity** `sim(U,R) = Σ_d w_d · c_d(R) · m_d(U,R) / Σ_d w_d` over only the dimensions the user specified. Here `m` = match 0..1 and `c` = reviewer confidence (unknown → 0).
  - Default weights: party 0.30, children 0.25 (age-band overlap, partial credit for adjacent bands), background 0.25, access 0.10, lifeStage 0.05, tags 0.05. The weights re-normalize when the user omits a dimension.
  - Background match = max(same country 1.0, shared cultural needs 0.8, same language 0.7). A reviewer matching several signals gets a small bonus, so "Israeli" = country + Hebrew + culture combined.
- **Tabs:** `sim ≥ 0.45` → "Like me", else "Everyone else". The threshold is tunable and will be calibrated from feedback data.
- **Review weight** `w = sim × recency × season`:
  - `recency = 0.5^(ageMonths/18)`.
  - `season = 1.3` if the visit month is within ±1 month of the trip month and the intent is season-sensitive. Same place means same hemisphere, so no hemisphere logic is needed.
- **Like-me rating** (Bayesian): `(Σ w·r + k·R_all) / (Σ w + k)`, k = 2.
  - **Confidence** from the evidence `min(Σw, n_eff)`, where `n_eff = (Σw)²/Σw²`: low <2.5, medium <6, high ≥6. `Σw` counts how much like-you evidence there is, and `n_eff` guards against one review dominating. (`n_eff` alone ignores match strength, so ten weak matches would read as high confidence.)
  - Display: "4.7★ from 9 people like you · high confidence · Everyone 4.1★ (1,240)".
- **Place rank** (Like-me tab): `R_like − 0.5/√(1+evidence) + relevance − distancePenalty`. The Everyone tab uses the classic overall rating.
- Reddit has no stars. Haiku infers 1–5 from sentiment, and the rating is marked "inferred".
- **Persona key:** a canonical string of coarse buckets (e.g. `party=family;kids=toddler,child;bg=IL,he,kosher;access=stroller`, no tags). It drives cache sharing between similar users.

## Screens

1. **Search (home):** two text boxes, "Who are you right now?" and "What are you looking for?". "Understood as" chips appear under each (tap ✕ to drop one). Saved-persona quick-switch. Location control (GPS / city / pin, radius slider). Optional "When?" if no date was mentioned. Time-window selector.
2. **Results:** tabs **Like me / Everyone else**, list ⇄ map toggle. Each card shows photo, name, distance, like-me rating vs overall, confidence badge, one-liner, top pros/cons/tips, source logos, ♥ favorite. Shimmer placeholders while scores stream in. A Share button uses the Web Share API (WhatsApp).
3. **Place deep-dive:** summary, then a review feed with **Like me / Everyone else** tabs. Each review shows a source badge, inferred persona chips + "why matched" evidence, date, stars, translated text + "show original", link to the original, and 👍/👎 "Is this person like you?". Also has a "Write a review" button.
4. **Me:** saved personas, search history, favorites, my reviews, language, sign out/delete account.
5. **Shared view** `/s/[slug]`: a read-only snapshot. Persona chips are hidden by default (privacy).
6. **Auth sheet:** Google / email code. Shown after the 2nd guest search.

## In-app reviews (v1)

- Stars, text, visit month/year, and a persona picked from saved personas or typed and parsed. One review per user per place, editable.
- Haiku moderation before publishing: spam/abuse, **strips children's names and other personal data**. Report button, plus an admin moderation view.
- Stored as `reviews.source = 'likewise'` with **persona confidence 1.0**, so it matches strongly. Author shown as a persona line only ("Israeli family, 4 kids (2–8) · visited Aug 2026").

## Data model (Supabase migrations)

- `profiles`: user_id, ui_lang, is_guest, guest_searches_used, consent flags
- `personas`: id, user_id, label, raw_text, parsed jsonb, persona_key
- `places`: id, name_en, name_local, geog (PostGIS), categories, google_place_id, tripadvisor_location_id, overall ratings/counts per source, reviews_fetched_at
- `reviews`: id, place_id, source (google | tripadvisor | reddit | likewise), source_review_id (unique per source), author_meta jsonb (hometown, trip_type), rating, rating_inferred, text, lang, published_at, visited_at, url, author_user_id (likewise only), moderation_status
- `review_personas`: review_id, extractor_version, persona jsonb, evidence
- `review_translations`: review_id, lang, text
- `searches`: id, user_id, persona_text, persona_parsed, target_text, intent jsonb, center geog, radius_km, window_months, trip_month, status, share_slug, cache_key
- `search_results`: search_id, place_id, rank, like_me_rating, n_eff, confidence, overall_rating, summary_id, status
- `place_summaries`: place_id, persona_key, intent_key, window, lang, content jsonb, review_ids[], corpus_version
- `favorites`; `match_feedback` (user, search, review | place, kind, value)
- `usage_ledger`: ts, search_id, provider, operation, units, tokens_in/out, cost_usd

Row-level security on every user-owned table. Guest limit enforced server-side, with hashed-IP rate limiting + Cloudflare Turnstile on guest searches.

## Cost & budget guard

- Every vendor and Claude call writes to `usage_ledger` with its computed cost.
- `/admin` shows cost per day, per search, and per provider.
- **Monthly cap $300:** email alerts at 50% and 80%. At 95%, "economy mode" turns on (no new deep fetches; official APIs + cache only). Per-user limit of 25 searches/day.
- Expected at prototype scale (~20 testers, ~150 searches/mo, ~50% cache hits, depth 80 + 40 reviews/place):

| Item | Estimate |
|---|---|
| Reviews via DataForSEO | ~$15–20 |
| Haiku 4.5 extraction | ~$50–60 |
| Sonnet 5 parsing + summaries | ~$15–25 |
| **Total** | **~$80–110/mo** |

  That leaves about 3× headroom under $300. Official Google/TripAdvisor usage should stay within free tiers.
- Model options the Phase 2 comparison will price with real numbers (same usage assumptions, including ~$20 of review data):

| Mix | Estimate |
|---|---|
| Haiku 4.5 reads reviews, Sonnet 5 summarizes (starting mix) | ~$80–110/mo |
| Same mix, deeper coverage (150 Google + 60 TripAdvisor per place) | ~$120–160/mo |
| Sonnet 5 for everything | ~$150–170/mo |
| Sonnet 5 reads, Opus 5 (`claude-opus-5`) summarizes | ~$170–200/mo |

  Nightly pre-warm runs through the Message Batches API at half price, which lowers all of these somewhat.
- Hosting starts free: Vercel Hobby, Supabase Free, Inngest, PostHog, Resend. Upgrade Supabase to Pro ($25) once testers are active, to avoid auto-pause.

## Repo layout

```
app/[locale]/(app)/page.tsx            search home
app/[locale]/search/[id]/page.tsx      results (tabs, list/map)
app/[locale]/place/[id]/page.tsx       deep-dive feed + write review
app/[locale]/me/...                    personas, history, favorites, my reviews
app/[locale]/s/[slug]/page.tsx         shared snapshot
app/[locale]/admin/page.tsx            cost + moderation
app/api/search/route.ts, app/api/inngest/route.ts, app/api/feedback/route.ts, ...
lib/sources/{types.ts, google-places.ts, tripadvisor.ts, dataforseo.ts, apify.ts, reddit.ts, likewise.ts}
lib/ai/{client.ts, models.ts, schemas.ts, parse-search.ts, extract-personas.ts, summarize.ts, translate.ts, moderate.ts}
lib/matching/{similarity.ts, rating.ts, season.ts, radius.ts, persona-key.ts}
lib/places/dedupe.ts   lib/budget/ledger.ts
inngest/{run-search.ts, refresh-place.ts, prewarm.ts}
supabase/migrations/*.sql
messages/{he,en}.json
evals/{persona-extraction, persona-parsing}/   tests/ (vitest)   e2e/ (playwright)
docs/PLAN.md (this plan, committed in Phase 0)
```

`SourceAdapter` interface: `discover(area, intent)`, `fetchReviews(place, {since, limit})`, `capabilities`. Facebook, AllTrails, etc. plug in later without touching the pipeline.

## Phases (each one ends with a push to the branch and a user test)

On approval of this revision, first sync `docs/PLAN.md` in the repo with this file (one commit). Then continue: the Phase 2 matching math and its unit tests need no keys and can start right away. Phase 1 needs the Google/TripAdvisor/DataForSEO keys, and the Phase 2 model comparison needs `ANTHROPIC_API_KEY`.

**0. Foundations** ✅ done (commits `be1af77`, `ce1767b`; CI green)
- Next.js 16 + TS + Tailwind + next-intl (he default, en) + RTL, PWA manifest + hand-written service worker (Serwist's plugin needs webpack; Next 16 builds with Turbopack), Supabase migration with RLS + explicit least-privilege grants, auth (Google, email OTP, anonymous guest with in-place upgrade).
- CI: lint, typecheck, Vitest, build, plus `scripts/db-test.sh` (migration + RLS tests on a fresh Postgres/PostGIS database). `docs/PLAN.md` and `docs/SETUP.md` committed.
- Not yet verified: live sign-in, which needs the user's Supabase project.
- **User action day 1:** create keys/accounts (list below), **apply for Reddit API access**.

**1. Sources & ingestion (starts with a spike)**
- Adapters for Google Places, TripAdvisor, DataForSEO (+ Apify fallback). Place dedupe. Usage ledger.
- Spike report: real vendor latency, available fields (trip type, reviewer hometown, original language), cost per place. The fastest workable vendor becomes the default.

**2. AI understanding & matching**
- Zod schemas, `parseSearch`, batched `extractReviewPersonas` with caching.
- Hand-labeled eval set: ~150 reviews (Hebrew/English/other) + ~40 persona texts.
- **Model comparison** (the user's budget decision): run review reading with Haiku 4.5 and Sonnet 5, and summaries with Sonnet 5 and Opus 5, on the same eval set. Report per-field accuracy (Hebrew separately), a blind side-by-side of sample summaries, and measured cost per 1,000 reviews / per summary, projected to monthly cost. The user picks a mix, and it's set in `lib/ai/models.ts`.
- Similarity/rating/season/radius/persona-key modules with unit tests.

**3. Search experience**
- Inngest `run-search` with progressive Realtime updates.
- Results tabs, list/map, summaries + confidence, deep-dive feed, on-demand translation, time window, season boost, smart radius, caching/reuse, budget guard.

**4. Account features**
- Saved personas + chips, history, favorites, share links, 👍/👎 feedback, 2-search guest gate with signup upgrade, PostHog events (repeat usage, feedback rate).

**5. In-app reviews**
- Write/edit, moderation, persona-only display, merged into scoring as the LikeWise source.

**6. Reddit** (once approved)
- Area/place thread search, mention extraction, inferred ratings.

**7. Hardening & tester launch**
- Attribution/display compliance (Google/TripAdvisor logos, links), privacy policy + consent (see risks), Lighthouse PWA pass, error monitoring, Vercel production deploy, pre-warm cron.

**Accounts/keys the user provides:**
- Anthropic API key
- Google Cloud project (Places API (New), Maps JavaScript, Geocoding) + OAuth client
- TripAdvisor Content API key
- DataForSEO account (+ optional Apify)
- Reddit API application
- Supabase, Vercel, Inngest, PostHog, Resend accounts

## Verification

- **Unit (Vitest):** similarity weights/normalization, background combination, recency/season math, Bayesian rating + n_eff confidence, persona-key canonicalization, dedupe (incl. Hebrew vs. English names), radius defaults.
- **Adapter contract tests** with recorded fixtures (no live API calls in CI).
- **AI evals** (`pnpm eval:persona`, `pnpm eval:parse`), with gates:
  - party type ≥85%
  - children present ≥90%
  - origin ≥80% (where stated)
  - no name-based inferences
  - Hebrew accuracy reported separately

  Re-run after any prompt/model change.
- **E2E (Playwright, pre-installed Chromium, mocked sources):** guest search → progressive results → tab switch → deep dive → translation toggle → 3rd search triggers signup; saved persona reuse; share link; RTL layout snapshots in he and en.
- **Manual acceptance on real APIs (staging):**
  1. "Family with 4 little kids, we're Israelis" + "museums" around Haifa
  2. "Dad with a 10-year-old son" + "easy hiking trail with water, in August" near Chania, Crete
  3. "Two friends in our 30s" + "restaurants" in central Rome

  Check that like-me reasons are shown, Hebrew/Israeli reviews are boosted, confidence badges make sense, a repeat/similar search is served from cache near-instantly, and the ledger cost per fresh search is ≤ ~$0.75.
- **PWA:** Lighthouse installability; install and GPS on Android + iOS.

## Risks & mitigations

- **Vendor data is a ToS gray area.** Fine for a closed prototype. Before any public launch, get a legal review, and lean on official APIs, licensed data, and in-app reviews.
- **Sparse persona signals in Google reviews.** Mitigated by TripAdvisor trip types, the review-language signal, the confidence indicator, the "Everyone else" tab, and in-app reviews with exact personas.
- **Sensitive personal data.** Kids' ages, nationality, and kosher/Shabbat (religious data, a GDPR special category). Mitigations: explicit consent on first persona save, delete-account/delete-persona, personas hidden in share links, no name-based inference.
- **Vendor latency.** Mitigated by progressive UI, the early signal from official APIs, cache reuse, and nightly pre-warm.
- **Reddit approval delay/denial.** Reddit is an isolated Phase 6 and v1 works without it.

## Sources consulted

- [TripAdvisor Location Reviews](https://tripadvisor-content-api.readme.io/reference/getlocationreviews), [TripAdvisor review breakdowns / trip type](https://developer-tripadvisor.com/content-api/business-content/review-count-and-breakdowns/)
- [Google Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Google Maps Platform pricing FAQ](https://developers.google.com/maps/billing-and-pricing/faq), [5-review limit](https://featurable.com/blog/google-places-more-than-5-reviews)
- [DataForSEO Google Reviews pricing](https://dataforseo.com/pricing/business-data/google-reviews-api), [DataForSEO TripAdvisor pricing](https://dataforseo.com/pricing/business-data/business-data-api-tripadvisor-pricing)
- [Apify Google Maps Reviews Scraper](https://apify.com/compass/google-maps-reviews-scraper), [Outscraper pricing](https://outscraper.com/pricing/)
- [Reddit Data API 2026 access](https://prowlo.com/blog/reddit-data-api), [Reddit API pricing 2026](https://octolens.com/blog/reddit-api-pricing)
