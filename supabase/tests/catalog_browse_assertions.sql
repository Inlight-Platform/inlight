SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE name text; visible integer; hidden integer; owner boolean; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('SELECT count(*), bool_or(is_owner) FROM public.%I WHERE id = %L', name || '_browse', 'db000000-0000-4000-8000-000000000001') INTO visible, owner;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id = %L', name || '_browse', 'db000000-0000-4000-8000-000000000002') INTO hidden;
  IF visible <> 1 OR owner IS DISTINCT FROM false OR hidden <> 0 THEN RAISE EXCEPTION 'Anonymous browse boundary failed: %', name; END IF;
  BEGIN
   EXECUTE format('SELECT submitted_by FROM public.%I', name || '_browse');
   RAISE EXCEPTION 'Submitter exposed in browse: %', name;
  EXCEPTION WHEN undefined_column THEN NULL; END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id = %L', name, 'db000000-0000-4000-8000-000000000001') INTO visible;
  IF visible <> 0 THEN RAISE EXCEPTION 'Raw anonymous submitter row leaked: %', name; END IF;
 END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE name text; owned boolean; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('SELECT is_owner FROM public.%I WHERE id = %L', name || '_browse', 'db000000-0000-4000-8000-000000000001') INTO owned;
  IF owned IS DISTINCT FROM true THEN RAISE EXCEPTION 'Ownership lost: %', name; END IF;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE name text; visible integer; owned boolean; updated integer; BEGIN
 FOREACH name IN ARRAY ARRAY['user_films','user_music_shows','nyc_shows'] LOOP
  EXECUTE format('SELECT is_owner FROM public.%I WHERE id = %L', name || '_browse', 'db000000-0000-4000-8000-000000000001') INTO owned;
  IF owned IS DISTINCT FROM false THEN RAISE EXCEPTION 'Other user reported as owner: %', name; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id = %L', name, 'db000000-0000-4000-8000-000000000001') INTO visible;
  IF visible <> 0 THEN RAISE EXCEPTION 'Other user can read submitter: %', name; END IF;
  EXECUTE format('UPDATE public.%I SET title = %L WHERE id = %L', name, 'Unauthorized change', 'db000000-0000-4000-8000-000000000001');
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 0 THEN RAISE EXCEPTION 'Other user update succeeded: %', name; END IF;
 END LOOP;
END $$;
RESET ROLE;
