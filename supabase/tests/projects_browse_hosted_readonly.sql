-- Run the entire script as administrator. It chooses one real non-admin user
-- from this environment for read-only role simulation; no placeholders/writes.
BEGIN READ ONLY;
DO $$ DECLARE mismatch boolean; actual_columns text[]; relation_name text; user_id uuid; ids jsonb; BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.projects_browse'::regclass
  AND 'security_invoker=true'=ANY(reloptions) AND 'security_barrier=true'=ANY(reloptions)) THEN
  RAISE EXCEPTION 'Project view options incorrect';
 END IF;
 SELECT array_agg(attname::text ORDER BY attnum) INTO actual_columns FROM pg_attribute
 WHERE attrelid='public.projects_browse_catalog'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual_columns IS DISTINCT FROM string_to_array('category, created_at, description, end_date, header_image_url, id, link_title, link_url, main_image_url, slug, start_date, status, title, visibility',', ') THEN
  RAISE EXCEPTION 'Unexpected metadata catalog columns';
 END IF;
 SELECT array_agg(attname::text ORDER BY attnum) INTO actual_columns FROM pg_attribute
 WHERE attrelid='public.projects_browse_attribution'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual_columns IS DISTINCT FROM ARRAY['id','creator_id','author_identity','author_group_id'] THEN
  RAISE EXCEPTION 'Unexpected attribution catalog columns';
 END IF;
 SELECT array_agg(attname::text ORDER BY attnum) INTO actual_columns FROM pg_attribute
 WHERE attrelid='public.projects_browse'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual_columns IS DISTINCT FROM ARRAY['category','created_at','creator_id','description','end_date',
  'header_image_url','id','link_title','link_url','main_image_url','slug','start_date','status','title',
  'visibility','author_identity','author_group_id'] THEN
  RAISE EXCEPTION 'Unexpected project browse columns';
 END IF;
 WITH expected AS (SELECT category, created_at, description, end_date, header_image_url, id, link_title, link_url, main_image_url, slug, start_date, status, title, visibility FROM public.projects)
 SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.projects_browse_catalog c)
  OR EXISTS (SELECT to_jsonb(c) FROM public.projects_browse_catalog c EXCEPT SELECT to_jsonb(e) FROM expected e) INTO mismatch;
 IF mismatch THEN RAISE EXCEPTION 'Metadata source/catalog mismatch'; END IF;
 WITH expected AS (SELECT id,creator_id,author_identity,author_group_id FROM public.projects)
 SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.projects_browse_attribution c)
  OR EXISTS (SELECT to_jsonb(c) FROM public.projects_browse_attribution c EXCEPT SELECT to_jsonb(e) FROM expected e) INTO mismatch;
 IF mismatch THEN RAISE EXCEPTION 'Attribution source/catalog mismatch'; END IF;
 FOREACH relation_name IN ARRAY ARRAY['projects_browse_catalog','projects_browse_attribution'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',relation_name)::regclass) THEN
   RAISE EXCEPTION 'Catalog RLS disabled: %',relation_name;
  END IF;
 END LOOP;
 IF has_function_privilege('anon','private.sync_projects_browse_catalog()','EXECUTE')
  OR has_function_privilege('authenticated','private.sync_projects_browse_catalog()','EXECUTE') THEN
  RAISE EXCEPTION 'Client trigger execution allowed';
 END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claim.role','anon',true);
 SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO ids FROM public.projects WHERE public.can_browse_project(id);
 PERFORM set_config('projects_browse_test.anon_ids',ids::text,true);
 SELECT u.id INTO user_id FROM auth.users u WHERE NOT public.has_role(u.id,'admin'::public.app_role) ORDER BY u.id LIMIT 1;
 IF user_id IS NULL THEN RAISE EXCEPTION 'A real non-admin user is required for the signed-in check'; END IF;
 PERFORM set_config('projects_browse_test.user_id',user_id::text,true);
 PERFORM set_config('request.jwt.claim.sub',user_id::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO ids FROM public.projects WHERE public.can_browse_project(id);
 PERFORM set_config('projects_browse_test.auth_ids',ids::text,true);
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','anon',true);
DO $$ DECLARE ids jsonb; relation_name text; privilege text; BEGIN
 SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO ids FROM public.projects_browse;
 IF ids IS DISTINCT FROM current_setting('projects_browse_test.anon_ids')::jsonb THEN
  RAISE EXCEPTION 'Anonymous browse audience mismatch';
 END IF;
 SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO ids FROM public.projects_browse_catalog;
 IF ids IS DISTINCT FROM current_setting('projects_browse_test.anon_ids')::jsonb THEN
  RAISE EXCEPTION 'Anonymous direct metadata audience mismatch';
 END IF;
 IF EXISTS (SELECT 1 FROM public.projects_browse_attribution) OR EXISTS (SELECT 1 FROM public.projects_browse
  WHERE creator_id IS NOT NULL OR author_identity IS NOT NULL OR author_group_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Anonymous attribution leaked';
 END IF;
 BEGIN
  SELECT id FROM public.projects LIMIT 1;
  RAISE EXCEPTION 'Anonymous raw projects readable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 FOREACH relation_name IN ARRAY ARRAY['projects_browse','projects_browse_catalog','projects_browse_attribution'] LOOP
  FOREACH privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
   IF has_table_privilege('anon','public.' || relation_name,privilege)
    OR has_table_privilege('authenticated','public.' || relation_name,privilege) THEN
    RAISE EXCEPTION 'Client catalog write grant: % %',relation_name,privilege;
   END IF;
  END LOOP;
 END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('projects_browse_test.user_id'),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE ids jsonb; relation_name text; BEGIN
 FOREACH relation_name IN ARRAY ARRAY['projects_browse','projects_browse_catalog','projects_browse_attribution'] LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(id ORDER BY id), %L::jsonb) FROM public.%I','[]',relation_name) INTO ids;
  IF ids IS DISTINCT FROM current_setting('projects_browse_test.auth_ids')::jsonb THEN
   RAISE EXCEPTION 'Signed-in audience mismatch: %',relation_name;
  END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM public.projects_browse WHERE creator_id IS NULL) THEN
  RAISE EXCEPTION 'Signed-in creator attribution missing';
 END IF;
 BEGIN
  SELECT google_drive_url FROM public.projects LIMIT 1;
  RAISE EXCEPTION 'Sensitive raw project field readable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'Projects browse checks passed' AS result,
 jsonb_array_length(current_setting('projects_browse_test.anon_ids')::jsonb) AS anonymous_project_count,
 jsonb_array_length(current_setting('projects_browse_test.auth_ids')::jsonb) AS tested_user_project_count,
 current_setting('projects_browse_test.user_id') AS tested_non_admin_user_id;
ROLLBACK;
