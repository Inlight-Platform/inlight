-- Run in an isolated database, inside a transaction after all Group grant follow-ups.
-- Synthetic identities avoid relying on production accounts or signup side effects.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email) VALUES
 ('ba5b137a-e63a-4372-9a18-3da3d90e4198', 'inv96-helper-member@example.test'),
 ('824fbc48-fbb1-46f9-9d08-b2eb136a3506', 'inv96-helper-admin@example.test'),
 ('abc126e7-0134-45d0-9585-ff54e1b4b9c1', 'inv96-helper-outsider@example.test')
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = origin;
INSERT INTO public.groups (id, slug, name, is_listed)
VALUES
 ('b1000000-0000-4000-8000-000000000001', 'inv96-private-helper-test', 'Private helper test', false),
 ('b1000000-0000-4000-8000-000000000002', 'inv96-listed-helper-test', 'Listed helper test', true);
INSERT INTO public.group_members (group_id, user_id, status)
VALUES ('b1000000-0000-4000-8000-000000000001', 'ba5b137a-e63a-4372-9a18-3da3d90e4198', 'active');
INSERT INTO public.group_admins (group_id, user_id, status)
VALUES ('b1000000-0000-4000-8000-000000000001', '824fbc48-fbb1-46f9-9d08-b2eb136a3506', 'active');
DELETE FROM public.user_roles WHERE user_id IN
 ('ba5b137a-e63a-4372-9a18-3da3d90e4198', '824fbc48-fbb1-46f9-9d08-b2eb136a3506', 'abc126e7-0134-45d0-9585-ff54e1b4b9c1');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"ba5b137a-e63a-4372-9a18-3da3d90e4198"}', true);
SELECT set_config('request.jwt.claim.sub', 'ba5b137a-e63a-4372-9a18-3da3d90e4198', true);
DO $$ BEGIN
 IF NOT public.is_group_member(auth.uid(), 'b1000000-0000-4000-8000-000000000001')
 OR NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='inv96-private-helper-test')
 OR NOT EXISTS (SELECT 1 FROM public.get_my_groups() WHERE slug='inv96-private-helper-test' AND NOT is_faculty)
 OR EXISTS (SELECT 1 FROM public.get_my_faculty_group() WHERE slug='inv96-private-helper-test')
 OR EXISTS (SELECT 1 FROM public.get_my_scoped_admin_groups() WHERE slug='inv96-private-helper-test')
 THEN RAISE EXCEPTION 'Member access failed'; END IF;
 IF public.is_group_faculty('824fbc48-fbb1-46f9-9d08-b2eb136a3506', 'b1000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Cross-user admin probe leaked'; END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"824fbc48-fbb1-46f9-9d08-b2eb136a3506"}', true);
SELECT set_config('request.jwt.claim.sub', '824fbc48-fbb1-46f9-9d08-b2eb136a3506', true);
DO $$ BEGIN
 IF NOT public.is_group_faculty(auth.uid(), 'b1000000-0000-4000-8000-000000000001')
 OR NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='inv96-private-helper-test')
 OR NOT EXISTS (SELECT 1 FROM public.get_my_groups() WHERE slug='inv96-private-helper-test')
 OR NOT EXISTS (SELECT 1 FROM public.get_my_scoped_admin_groups() WHERE slug='inv96-private-helper-test')
 THEN RAISE EXCEPTION 'Scoped admin access failed'; END IF;
END $$;

-- The faculty lookup returns only the first administered Group, ordered by name.
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.get_my_faculty_group() f
   JOIN public.get_my_scoped_admin_groups() s ON s.id=f.id
 ) THEN RAISE EXCEPTION 'Faculty lookup failed for scoped admin'; END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"abc126e7-0134-45d0-9585-ff54e1b4b9c1"}', true);
SELECT set_config('request.jwt.claim.sub', 'abc126e7-0134-45d0-9585-ff54e1b4b9c1', true);
DO $$ BEGIN
 IF public.is_group_member(auth.uid(), 'b1000000-0000-4000-8000-000000000001')
 OR public.is_group_member('ba5b137a-e63a-4372-9a18-3da3d90e4198', 'b1000000-0000-4000-8000-000000000001')
 OR EXISTS (SELECT 1 FROM public.groups WHERE slug='inv96-private-helper-test')
 OR EXISTS (SELECT 1 FROM public.get_my_groups() WHERE slug='inv96-private-helper-test')
 OR EXISTS (SELECT 1 FROM public.get_my_faculty_group() WHERE slug='inv96-private-helper-test')
 OR EXISTS (SELECT 1 FROM public.get_my_scoped_admin_groups() WHERE slug='inv96-private-helper-test')
 THEN RAISE EXCEPTION 'Nonmember access/probe failed'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
 IF has_function_privilege('anon', 'public.get_my_groups()', 'EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous Group RPC privilege leaked';
 END IF;
 BEGIN
   PERFORM * FROM public.get_my_groups();
   RAISE EXCEPTION 'Anonymous Group RPC call unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='inv96-listed-helper-test')
 OR EXISTS (SELECT 1 FROM public.groups WHERE slug='inv96-private-helper-test')
 OR public.is_group_member('ba5b137a-e63a-4372-9a18-3da3d90e4198', 'b1000000-0000-4000-8000-000000000001')
 OR public.is_group_faculty('824fbc48-fbb1-46f9-9d08-b2eb136a3506', 'b1000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Anonymous directory/probe failed'; END IF;
END $$;

DO $$
DECLARE fn text;
BEGIN
 FOREACH fn IN ARRAY ARRAY['get_my_groups', 'get_my_faculty_group', 'get_my_scoped_admin_groups'] LOOP
   IF has_function_privilege('anon', format('public.%I()', fn), 'EXECUTE') THEN
     RAISE EXCEPTION 'Anonymous privilege leaked for %', fn;
   END IF;
   BEGIN
     EXECUTE format('SELECT * FROM public.%I()', fn);
     RAISE EXCEPTION 'Anonymous call unexpectedly succeeded for %', fn;
   EXCEPTION WHEN insufficient_privilege THEN NULL;
   END;
 END LOOP;
END $$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$ BEGIN
 IF NOT public.is_group_member('ba5b137a-e63a-4372-9a18-3da3d90e4198', 'b1000000-0000-4000-8000-000000000001')
 OR NOT public.is_group_faculty('824fbc48-fbb1-46f9-9d08-b2eb136a3506', 'b1000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Service access failed'; END IF;
END $$;
RESET ROLE;
