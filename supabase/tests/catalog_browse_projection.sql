DO $$ DECLARE name text; BEGIN
 IF has_table_privilege('anon', 'public.catalog_ownership', 'INSERT,UPDATE,DELETE,TRUNCATE')
 OR has_table_privilege('authenticated', 'public.catalog_ownership', 'INSERT,UPDATE,DELETE,TRUNCATE')
 THEN RAISE EXCEPTION 'Client can forge ownership'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.catalog_row_is_owner(text,uuid)'::regprocedure AND prosecdef)
 THEN RAISE EXCEPTION 'Ownership helper bypasses caller RLS'; END IF;
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  IF NOT EXISTS (
   SELECT 1 FROM pg_class WHERE oid = ('public.' || name || '_browse')::regclass
   AND 'security_invoker=true' = ANY(reloptions)
  ) THEN RAISE EXCEPTION 'View still bypasses caller permissions: %', name; END IF;
  IF EXISTS (
   SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name=name || '_public_catalog' AND column_name='submitted_by'
  ) THEN RAISE EXCEPTION 'Submitter stored in public projection: %', name; END IF;
  IF has_table_privilege('anon', 'public.' || name || '_public_catalog', 'INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege('authenticated', 'public.' || name || '_public_catalog', 'INSERT,UPDATE,DELETE,TRUNCATE')
  THEN RAISE EXCEPTION 'Client can modify projection: %', name; END IF;
 END LOOP;
END $$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.catalog_ownership)
 THEN RAISE EXCEPTION 'Anonymous ownership identity leaked'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.catalog_ownership WHERE user_id <> auth.uid())
 THEN RAISE EXCEPTION 'Cross-user ownership identity leaked'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE name text; current_title text; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('UPDATE public.%I SET title=%L WHERE id=%L', name, 'Edited sentinel', 'db000000-0000-4000-8000-000000000001');
  EXECUTE format('SELECT title FROM public.%I WHERE id=%L', name || '_browse', 'db000000-0000-4000-8000-000000000001') INTO current_title;
  IF current_title IS DISTINCT FROM 'Edited sentinel' THEN RAISE EXCEPTION 'Update did not sync: %', name; END IF;
  EXECUTE format('UPDATE public.%I SET is_active=false WHERE id=%L', name, 'db000000-0000-4000-8000-000000000001');
 END LOOP;
END $$;

-- Exercise live INSERT and DELETE triggers, then rollback even TRUNCATE tests.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);
INSERT INTO public.user_films(id,title,link_url,submitted_by,is_active)
VALUES ('db000000-0000-4000-8000-000000000003','Inserted film','https://example.test/new','da000000-0000-4000-8000-000000000001',true);
INSERT INTO public.user_music_shows(id,title,submitted_by,is_active)
VALUES ('db000000-0000-4000-8000-000000000003','Inserted music','da000000-0000-4000-8000-000000000001',true);
INSERT INTO public.nyc_shows(id,title,venue,category,submitted_by,is_active)
VALUES ('db000000-0000-4000-8000-000000000003','Inserted show','Venue','school','da000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE name text; owned boolean; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('SELECT is_owner FROM public.%I WHERE id=%L', name || '_browse', 'db000000-0000-4000-8000-000000000003') INTO owned;
  IF owned IS DISTINCT FROM true THEN RAISE EXCEPTION 'Insert did not sync ownership: %', name; END IF;
 END LOOP;
END $$;
RESET ROLE;
-- Test ownership transfer as the database administrator, as client write
-- policies correctly prohibit assigning an entry to another submitter.
UPDATE public.user_films SET submitted_by='da000000-0000-4000-8000-000000000002'
WHERE id='db000000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
 IF NOT public.catalog_row_is_owner('user_films', 'db000000-0000-4000-8000-000000000003')
 THEN RAISE EXCEPTION 'Ownership transfer did not sync'; END IF;
END $$;
RESET ROLE;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE name text; visible integer; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN (%L,%L)', name || '_browse', 'db000000-0000-4000-8000-000000000001', 'db000000-0000-4000-8000-000000000002') INTO visible;
  IF visible <> 0 THEN RAISE EXCEPTION 'Inactive row exposed: %', name; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN (%L,%L)', name || '_public_catalog', 'db000000-0000-4000-8000-000000000001', 'db000000-0000-4000-8000-000000000002') INTO visible;
  IF visible <> 0 THEN RAISE EXCEPTION 'Direct projection bypassed RLS: %', name; END IF;
 END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE name text; visible integer; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('UPDATE public.%I SET is_active=true WHERE id=%L', name, 'db000000-0000-4000-8000-000000000001');
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=%L', name || '_browse', 'db000000-0000-4000-8000-000000000001') INTO visible;
  IF visible <> 1 THEN RAISE EXCEPTION 'Reactivation did not sync: %', name; END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id=%L', name, 'db000000-0000-4000-8000-000000000001');
 END LOOP;
END $$;
RESET ROLE;
DO $$ DECLARE name text; visible integer; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=%L', name || '_public_catalog', 'db000000-0000-4000-8000-000000000001') INTO visible;
  IF visible <> 0 OR EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog=name AND row_id='db000000-0000-4000-8000-000000000001')
  THEN RAISE EXCEPTION 'Delete left stale data or ownership: %', name; END IF;
 END LOOP;
END $$;
TRUNCATE public.user_films;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.user_films_public_catalog)
 OR EXISTS (SELECT 1 FROM public.catalog_ownership WHERE catalog='user_films')
 THEN RAISE EXCEPTION 'Truncate left stale projection data'; END IF;
END $$;
