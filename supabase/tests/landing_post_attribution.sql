-- Run against a disposable database with the migration installed, inside a
-- transaction. ROLLBACK removes all synthetic fixtures.
BEGIN;
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email)
SELECT ('ca000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'landing-author-' || i || '@example.test'
FROM generate_series(1, 6) i;
INSERT INTO public.profiles (user_id, email, display_name, avatar_url, hidden_from_public)
SELECT ('ca000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'landing-author-' || i || '@example.test',
       'Landing Author ' || i,
       'https://example.test/author-' || i || '.jpg', i = 5
FROM generate_series(1, 6) i;
INSERT INTO public.posts (id, user_id, content, visibility, author_identity, created_at)
SELECT ('cb000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       ('ca000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'Landing public update ' || i, 'public', 'personal', '2099-01-01'::timestamptz + i * interval '1 hour'
FROM generate_series(1, 6) i;
-- Newer rows must not leak or displace the four eligible authors.
INSERT INTO public.posts (id, user_id, content, visibility, author_identity, created_at)
VALUES
 ('cb000000-0000-4000-8000-000000000007', 'ca000000-0000-4000-8000-000000000001', 'Private sentinel', 'network', 'personal', '2099-02-01'),
 ('cb000000-0000-4000-8000-000000000008', 'ca000000-0000-4000-8000-000000000002', 'Group identity sentinel', 'public', 'group', '2099-02-02'),
 ('cb000000-0000-4000-8000-000000000009', 'ca000000-0000-4000-8000-000000000003', 'Group-only sentinel', 'group', 'personal', '2099-02-03'),
 ('cb000000-0000-4000-8000-000000000010', 'ca000000-0000-4000-8000-000000000004', 'Newest author four update', 'public', 'personal', '2099-02-04');
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
DECLARE actual_ids uuid[]; actual_names text[];
BEGIN
 SELECT array_agg(id ORDER BY created_at DESC, id DESC) INTO actual_ids
 FROM public.get_landing_public_posts();
 IF actual_ids IS DISTINCT FROM ARRAY[
   'cb000000-0000-4000-8000-000000000010'::uuid,
   'cb000000-0000-4000-8000-000000000006'::uuid,
   'cb000000-0000-4000-8000-000000000003'::uuid,
   'cb000000-0000-4000-8000-000000000002'::uuid
 ] THEN RAISE EXCEPTION 'Unexpected anonymous preview rows: %', actual_ids; END IF;
 SELECT array_agg(creator_name ORDER BY created_at DESC, id DESC) INTO actual_names
 FROM public.get_landing_public_posts();
 IF actual_names IS DISTINCT FROM ARRAY['Landing Author 4', 'Landing Author 6', 'Landing Author 3', 'Landing Author 2']
 THEN RAISE EXCEPTION 'Post/author mismatch: %', actual_names; END IF;
 IF EXISTS (
   SELECT 1 FROM public.get_landing_public_posts()
   WHERE creator_avatar IS DISTINCT FROM 'https://example.test/author-' || split_part(creator_name, ' ', 3) || '.jpg'
 ) THEN RAISE EXCEPTION 'Post name/avatar attribution mismatch'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"ca000000-0000-4000-8000-000000000005"}', true);
SELECT set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000005', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.get_landing_public_posts()) <> 4
 OR EXISTS (SELECT 1 FROM public.get_landing_public_posts() WHERE creator_name = 'Landing Author 5' OR content LIKE '%sentinel%')
 THEN RAISE EXCEPTION 'Hidden account or private/group identity leaked to signed-in preview'; END IF;
END $$;
RESET ROLE;
-- Isolate the fallback test from existing local profiles; all updates roll back.
SET LOCAL session_replication_role = replica;
UPDATE public.profiles SET hidden_from_public = true
WHERE user_id NOT IN (
 SELECT ('ca000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid FROM generate_series(1, 6) i
);
UPDATE public.profiles SET bio = 'Real profile bio for ' || display_name,
 activity_score = right(user_id::text, 1)::integer
WHERE user_id::text LIKE 'ca000000-%';
UPDATE public.profiles SET display_name = 'Inlight'
WHERE user_id = 'ca000000-0000-4000-8000-000000000006';
UPDATE public.posts SET visibility = 'network'
WHERE id IN ('cb000000-0000-4000-8000-000000000002', 'cb000000-0000-4000-8000-000000000003');
SET LOCAL session_replication_role = origin;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.get_landing_track_cards()) <> 4
 OR (SELECT count(DISTINCT creator_name) FROM public.get_landing_track_cards()) <> 4
 OR (SELECT count(*) FROM public.get_landing_track_cards() WHERE is_profile_highlight) <> 2
 OR EXISTS (SELECT 1 FROM public.get_landing_track_cards() WHERE creator_name IN ('Inlight', 'Landing Author 5') OR content LIKE '%sentinel%')
 OR EXISTS (SELECT 1 FROM public.get_landing_track_cards() WHERE is_profile_highlight AND content NOT LIKE 'Real profile bio for %')
 THEN RAISE EXCEPTION 'Public profile fallback or identity boundaries failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
