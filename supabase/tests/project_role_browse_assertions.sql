DO $$ BEGIN
  IF EXISTS (SELECT fields FROM expected_role_teasers EXCEPT SELECT to_jsonb(c) FROM public.project_roles_public_browse c)
    OR EXISTS (SELECT to_jsonb(c) FROM public.project_roles_public_browse c EXCEPT SELECT fields FROM expected_role_teasers) THEN
    RAISE EXCEPTION 'Public role compatibility failed';
  END IF;
  IF EXISTS (SELECT * FROM expected_role_columns EXCEPT SELECT attname, atttypid, atttypmod, attnum
    FROM pg_attribute WHERE attrelid = 'public.project_roles_public_browse'::regclass AND attnum > 0 AND NOT attisdropped)
    OR EXISTS (SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute
      WHERE attrelid = 'public.project_roles_public_browse'::regclass AND attnum > 0 AND NOT attisdropped
      EXCEPT SELECT * FROM expected_role_columns) THEN
    RAISE EXCEPTION 'Role column/type contract changed';
  END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; BEGIN
  IF (SELECT count(*) FROM public.project_roles_public_browse WHERE id::text LIKE 'd3000000-%') <> 2 THEN
    RAISE EXCEPTION 'Anonymous public role boundary failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_roles_public_browse WHERE id IN
    ('d3000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000003',
     'd3000000-0000-4000-8000-000000000004')) THEN
    RAISE EXCEPTION 'Assigned/private roles leaked';
  END IF;
  FOREACH source_name IN ARRAY ARRAY['projects', 'project_roles'] LOOP
    BEGIN
      EXECUTE format('SELECT id FROM public.%I LIMIT 1', source_name);
      RAISE EXCEPTION 'Anonymous raw source access allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE affected integer; BEGIN
  IF EXISTS (SELECT 1 FROM public.project_roles WHERE project_id IN
    ('d2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000003')) THEN
    RAISE EXCEPTION 'Unrelated private role read allowed';
  END IF;
  UPDATE public.project_roles SET role_name = 'Unauthorized' WHERE id = 'd3000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Non-owner role edit allowed'; END IF;
  DELETE FROM public.project_roles WHERE id = 'd3000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Non-owner role delete allowed'; END IF;
  BEGIN
    INSERT INTO public.project_roles(id, project_id, role_name)
    VALUES ('d3000000-0000-4000-8000-000000000099', 'd2000000-0000-4000-8000-000000000001', 'Unauthorized');
    RAISE EXCEPTION 'Non-owner role creation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE affected integer; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.project_roles WHERE id = 'd3000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Owner private role access denied';
  END IF;
  UPDATE public.project_roles SET role_name = 'Owner edited role' WHERE id = 'd3000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner role edit denied'; END IF;
  INSERT INTO public.project_roles(id, project_id, role_name)
  VALUES ('d3000000-0000-4000-8000-000000000098', 'd2000000-0000-4000-8000-000000000001', 'Owner temporary role');
  DELETE FROM public.project_roles WHERE id = 'd3000000-0000-4000-8000-000000000098';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner role deletion denied'; END IF;
END $$;
RESET ROLE;
