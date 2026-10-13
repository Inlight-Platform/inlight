-- Expected rows were captured from the old owner-permission view.
GRANT SELECT ON expected_project_rows TO anon, authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT * FROM expected_project_columns EXCEPT SELECT attname,atttypid,atttypmod,attnum
  FROM pg_attribute WHERE attrelid='public.projects_browse'::regclass AND attnum>0 AND NOT attisdropped)
 OR EXISTS (SELECT attname,atttypid,atttypmod,attnum FROM pg_attribute
  WHERE attrelid='public.projects_browse'::regclass AND attnum>0 AND NOT attisdropped EXCEPT SELECT * FROM expected_project_columns) THEN
  RAISE EXCEPTION 'Project column/type contract changed';
 END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF EXISTS (SELECT fields FROM expected_project_rows WHERE viewer=0 EXCEPT SELECT to_jsonb(p) FROM public.projects_browse p)
 OR EXISTS (SELECT to_jsonb(p) FROM public.projects_browse p EXCEPT SELECT fields FROM expected_project_rows WHERE viewer=0) THEN
  RAISE EXCEPTION 'Anonymous browse compatibility failed';
 END IF;
 IF (SELECT count(*) FROM public.projects_browse WHERE id::text LIKE 'c2000000-%')<>1 THEN
  RAISE EXCEPTION 'Anonymous private projects leaked';
 END IF;
 IF EXISTS (SELECT 1 FROM public.projects_browse WHERE creator_id IS NOT NULL OR author_identity IS NOT NULL OR author_group_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Anonymous attribution leaked';
 END IF;
 BEGIN
  SELECT id FROM public.projects LIMIT 1;
  RAISE EXCEPTION 'Anonymous raw projects allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE i integer; rows integer; expected integer; BEGIN
 FOR i IN 1..9 LOOP
  PERFORM set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-' || lpad(i::text,12,'0'),true);
  IF EXISTS (SELECT fields FROM expected_project_rows WHERE viewer=i EXCEPT SELECT to_jsonb(p) FROM public.projects_browse p)
   OR EXISTS (SELECT to_jsonb(p) FROM public.projects_browse p EXCEPT SELECT fields FROM expected_project_rows WHERE viewer=i) THEN
   RAISE EXCEPTION 'Signed-in browse compatibility failed for viewer %',i;
  END IF;
  SELECT count(*) INTO rows FROM public.projects_browse WHERE id::text LIKE 'c2000000-%';
  expected:=CASE WHEN i IN (1,6) THEN 4 WHEN i IN (2,3,4,5,9) THEN 2 ELSE 1 END;
  IF rows<>expected THEN RAISE EXCEPTION 'Project audience failed for viewer %: % expected %',i,rows,expected; END IF;
  IF EXISTS (SELECT 1 FROM public.projects_browse WHERE id::text LIKE 'c2000000-%'
   AND creator_id IS DISTINCT FROM 'c1000000-0000-4000-8000-000000000001'::uuid) THEN
   RAISE EXCEPTION 'Signed-in owner attribution missing for viewer %',i;
  END IF;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000007',true);
DO $$ DECLARE affected integer; BEGIN
 UPDATE public.projects SET title='Unauthorized' WHERE id='c2000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Unrelated edit allowed'; END IF;
 DELETE FROM public.projects WHERE id='c2000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Unrelated delete allowed'; END IF;
 BEGIN
  SELECT google_drive_url FROM public.projects LIMIT 1;
  RAISE EXCEPTION 'Sensitive source field read allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE affected integer; BEGIN
 UPDATE public.projects SET title='Owner edited project' WHERE id='c2000000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Owner edit denied'; END IF;
END $$;
RESET ROLE;
