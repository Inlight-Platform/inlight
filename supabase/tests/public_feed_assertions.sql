SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; rows integer; leaked boolean; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id::text LIKE %L', source_name || '_public_browse', 'e2000000-%') INTO rows;
    IF rows <> 1 THEN RAISE EXCEPTION 'Anonymous public boundary failed: %', source_name; END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I c WHERE to_jsonb(c) ? %L)', source_name || '_public_browse', 'user_id') INTO leaked;
    IF leaked THEN RAISE EXCEPTION 'Creator identifier leaked: %', source_name; END IF;
    BEGIN
      EXECUTE format('SELECT * FROM public.%I LIMIT 1', source_name);
      RAISE EXCEPTION 'Anonymous raw source read allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE format('SELECT count(*) FROM public.%I($1)', 'get_public_profile_' || source_name) INTO rows
      USING 'e1000000-0000-4000-8000-000000000001'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Public profile activity boundary failed: %', source_name; END IF;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE source_name text; affected integer; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1, $2, $3)', source_name)
      INTO rows USING 'e2000000-0000-4000-8000-000000000002'::uuid,
        'e2000000-0000-4000-8000-000000000003'::uuid, 'e2000000-0000-4000-8000-000000000004'::uuid;
    IF rows <> 0 THEN RAISE EXCEPTION 'Unrelated private source reads allowed: %', source_name; END IF;
    EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id = $2', source_name, CASE source_name WHEN 'posts' THEN 'content' ELSE 'title' END)
      USING 'Unauthorized edit', 'e2000000-0000-4000-8000-000000000001'::uuid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Unrelated update allowed: %', source_name; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', source_name) USING 'e2000000-0000-4000-8000-000000000001'::uuid;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Unrelated delete allowed: %', source_name; END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE source_name text; rows integer; BEGIN
  FOREACH source_name IN ARRAY ARRAY['posts', 'events'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = $1 AND user_id = auth.uid()', source_name) INTO rows
      USING 'e2000000-0000-4000-8000-000000000002'::uuid;
    IF rows <> 1 THEN RAISE EXCEPTION 'Owner private source access failed: %', source_name; END IF;
  END LOOP;
END $$;
RESET ROLE;
