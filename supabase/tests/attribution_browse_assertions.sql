SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I LIMIT 1', source_name || '_browse');
      RAISE EXCEPTION 'Anonymous browse allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE source_name text; rows integer; affected integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studios', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name || '_browse') INTO rows
      USING 'df000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Signed-in browse failed: %', source_name; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1', source_name) INTO rows
      USING 'df000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 0 THEN RAISE EXCEPTION 'Unrelated source row leaked: %', source_name; END IF;
  END LOOP;
  FOREACH source_name IN ARRAY ARRAY['show_tips', 'studio_posts'] LOOP
    EXECUTE format('UPDATE public.%I SET content = $1 WHERE id = $2', source_name)
      USING 'Unauthorized', 'df000000-0000-4000-8000-000000000001'::uuid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Unrelated update allowed: %', source_name; END IF;
  END LOOP;
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', source_name)
      USING 'df000000-0000-4000-8000-000000000001'::uuid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Unrelated delete allowed: %', source_name; END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['show_teammates', 'show_tips', 'studio_posts', 'studio_comments'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1 AND user_id = auth.uid()', source_name) INTO rows
      USING 'df000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Author source read failed: %', source_name; END IF;
  END LOOP;
END $$;
RESET ROLE;
