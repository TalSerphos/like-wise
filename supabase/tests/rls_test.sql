-- RLS and trigger checks. Runs as a superuser, switching roles to simulate
-- signed-in users; any failed assertion raises and aborts the script.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000c', true);

-- Profiles are created for every user; guests are flagged.
do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profile per user';
  assert (select is_guest from public.profiles where user_id = '00000000-0000-0000-0000-00000000000c'), 'guest flagged';
end $$;

-- A guest who signs up is no longer flagged.
update auth.users set is_anonymous = false, email = 'c@example.com'
  where id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert not (select is_guest from public.profiles where user_id = '00000000-0000-0000-0000-00000000000c'), 'guest upgraded';
end $$;

-- Shared catalog data (inserted as service role).
insert into public.places (id, name_en, location) values
  ('10000000-0000-0000-0000-000000000001', 'Madatech', extensions.st_point(34.9965, 32.8120)::extensions.geography);
insert into public.reviews (place_id, source, source_review_id, body, rating) values
  ('10000000-0000-0000-0000-000000000001', 'google', 'g1', 'Great for kids', 5);
insert into public.reviews (place_id, source, source_review_id, body, rating, author_user_id, moderation_status) values
  ('10000000-0000-0000-0000-000000000001', 'likewise', 'lw1', 'Pending review', 4, '00000000-0000-0000-0000-00000000000a', 'pending');
insert into public.searches (id, user_id, persona_text, target_text) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'family', 'museums');
insert into public.search_results (search_id, place_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.usage_ledger (provider, operation, cost_usd) values ('anthropic', 'extract', 0.01);

-- Anonymous visitors: catalog yes, pending reviews and private data no.
set local role anon;
do $$ begin
  assert (select count(*) from public.places) = 1, 'anon reads places';
  assert (select count(*) from public.reviews) = 1, 'anon sees only approved reviews';
  begin
    perform count(*) from public.searches;
    assert false, 'anon must not read searches';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.usage_ledger;
    assert false, 'anon must not read the ledger';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- User A: own data plus own pending review.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.reviews) = 2, 'author sees own pending review';
  assert (select count(*) from public.searches) = 1, 'A reads own search';
  assert (select count(*) from public.search_results) = 1, 'A reads own results';
  assert (select count(*) from public.profiles) = 1, 'A reads only own profile';
end $$;
insert into public.personas (user_id, raw_text, parsed, persona_key)
  values ('00000000-0000-0000-0000-00000000000a', 'family with 4 kids', '{}', 'party=family');
insert into public.favorites (user_id, place_id)
  values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');

-- User A cannot write rows for someone else or touch shared tables.
do $$ begin
  begin
    insert into public.personas (user_id, raw_text, parsed, persona_key)
      values ('00000000-0000-0000-0000-00000000000b', 'x', '{}', 'k');
    assert false, 'insert persona for other user should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.places (name_en, location) values ('Fake', extensions.st_point(0, 0)::extensions.geography);
    assert false, 'insert place should fail';
  exception when insufficient_privilege then null;
  end;
  -- Guests must not be able to reset their free-search counter.
  begin
    update public.profiles set guest_searches_used = 0;
    assert false, 'updating guest counter should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.ai_cache;
    assert false, 'reading ai_cache should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.profiles set ui_lang = 'en';
do $$ begin
  assert (select ui_lang from public.profiles) = 'en', 'user can change own language';
end $$;
reset role;

-- User B sees none of A's private rows.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.personas) = 0, 'B cannot read A personas';
  assert (select count(*) from public.searches) = 0, 'B cannot read A searches';
  assert (select count(*) from public.search_results) = 0, 'B cannot read A results';
  assert (select count(*) from public.favorites) = 0, 'B cannot read A favorites';
  assert (select count(*) from public.reviews) = 1, 'B cannot read A pending review';
end $$;
update public.personas set label = 'hijack';
do $$ begin
  assert (select count(*) from public.personas where label = 'hijack') = 0, 'B cannot update A personas';
end $$;
reset role;

-- Deleting a user removes their personal data.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.personas) = 0, 'personas deleted with user';
  assert (select count(*) from public.searches) = 0, 'searches deleted with user';
  assert (select count(*) from public.reviews where source = 'likewise') = 0, 'in-app reviews deleted with user';
end $$;

rollback;
\echo 'RLS tests passed'
