-- Run the entire script as administrator in the target SQL Editor.
-- No placeholders, fixtures, writes, deletes or truncation.
BEGIN READ ONLY;
DO $$ DECLARE actual_columns text[]; relation_name text; mismatch boolean; rows bigint; BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.project_roles_public_browse'::regclass
    AND 'security_invoker=true' = ANY(reloptions) AND 'security_barrier=true' = ANY(reloptions)) THEN
    RAISE EXCEPTION 'Public role view options incorrect';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY['project_roles_public_browse', 'project_roles_public_catalog'] LOOP
    SELECT array_agg(attname::text ORDER BY attnum) INTO actual_columns FROM pg_attribute
    WHERE attrelid = format('public.%I', relation_name)::regclass AND attnum > 0 AND NOT attisdropped;
    IF actual_columns IS DISTINCT FROM ARRAY['id', 'role_name', 'project_id', 'project_title', 'project_deadline', 'created_at'] THEN
      RAISE EXCEPTION 'Unexpected role public fields: %', relation_name;
    END IF;
  END LOOP;
  WITH expected AS (
    SELECT r.id, r.role_name, r.project_id, p.title AS project_title, p.end_date AS project_deadline, r.created_at
    FROM public.project_roles r JOIN public.projects p ON p.id = r.project_id
    WHERE r.assigned_user_id IS NULL AND COALESCE(p.is_public, false)
  )
  SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.project_roles_public_catalog c)
    OR EXISTS (SELECT to_jsonb(c) FROM public.project_roles_public_catalog c EXCEPT SELECT to_jsonb(e) FROM expected e)
    INTO mismatch;
  IF mismatch THEN RAISE EXCEPTION 'Public role source/catalog mismatch'; END IF;
  SELECT count(*) INTO rows FROM public.project_roles_public_catalog;
  PERFORM set_config('role_browse_test.count', rows::text, true);
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.project_roles_public_catalog'::regclass) THEN
    RAISE EXCEPTION 'Role catalog RLS disabled';
  END IF;
  IF has_function_privilege('anon', 'private.sync_project_role_public_catalog()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'private.sync_project_role_public_catalog()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client projection trigger execution allowed';
  END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE source_name text; relation_name text; privilege text; rows bigint; BEGIN
  FOREACH source_name IN ARRAY ARRAY['projects', 'project_roles'] LOOP
    BEGIN
      EXECUTE format('SELECT id FROM public.%I LIMIT 1', source_name);
      RAISE EXCEPTION 'Anonymous raw source read allowed: %', source_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  FOREACH relation_name IN ARRAY ARRAY['project_roles_public_browse', 'project_roles_public_catalog'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', relation_name) INTO rows;
    IF rows <> current_setting('role_browse_test.count')::bigint THEN
      RAISE EXCEPTION 'Anonymous role count mismatch: %', relation_name;
    END IF;
    FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
      IF has_table_privilege('anon', 'public.' || relation_name, privilege)
        OR has_table_privilege('authenticated', 'public.' || relation_name, privilege) THEN
        RAISE EXCEPTION 'Client role projection write grant: % %', relation_name, privilege;
      END IF;
    END LOOP;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.project_roles_public_browse) <> current_setting('role_browse_test.count')::bigint THEN
    RAISE EXCEPTION 'Signed-in public role count mismatch';
  END IF;
END $$;
RESET ROLE;
SELECT 'Project role browse checks passed' AS result, current_setting('role_browse_test.count')::bigint AS public_role_count;
ROLLBACK;
