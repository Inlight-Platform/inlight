-- Run the entire script as administrator in the target SQL Editor.
-- No fixtures, writes, placeholders, or production mutations.
BEGIN READ ONLY;
DO $$ DECLARE mismatch boolean; relation_name text; actual_columns text[]; rows bigint; BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.opportunities_public_browse'::regclass
    AND 'security_invoker=true' = ANY(reloptions) AND 'security_barrier=true' = ANY(reloptions)) THEN
    RAISE EXCEPTION 'Opportunity view options incorrect';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY['opportunities_public_browse', 'opportunities_public_catalog'] LOOP
    SELECT array_agg(attname::text ORDER BY attnum) INTO actual_columns FROM pg_attribute
    WHERE attrelid = format('public.%I', relation_name)::regclass AND attnum > 0 AND NOT attisdropped;
    IF actual_columns IS DISTINCT FROM string_to_array('id, title, description, type, status, posted_by, company, location, is_remote, compensation, experience_level, roles, requirements, deadline, start_date, duration, tags, is_featured, action_type, image_url, link_url, link_title, is_public, created_at, updated_at', ', ') THEN
      RAISE EXCEPTION 'Unexpected public columns: %', relation_name;
    END IF;
  END LOOP;
  WITH expected AS (SELECT
  o.id,
  o.title,
  CASE WHEN o.action_type = 'external' THEN o.description ELSE ''::text END AS description,
  o.type,
  o.status,
  NULL::uuid AS posted_by,
  o.company,
  o.location,
  o.is_remote,
  CASE WHEN o.action_type = 'external' THEN o.compensation ELSE NULL::text END AS compensation,
  o.experience_level,
  CASE WHEN o.action_type = 'external' THEN o.roles ELSE ARRAY[]::text[] END AS roles,
  CASE WHEN o.action_type = 'external' THEN o.requirements ELSE ARRAY[]::text[] END AS requirements,
  o.deadline,
  o.start_date,
  o.duration,
  o.tags,
  o.is_featured,
  o.action_type,
  o.image_url,
  CASE WHEN o.action_type = 'external' THEN o.link_url ELSE NULL::text END AS link_url,
  CASE WHEN o.action_type = 'external' THEN o.link_title ELSE NULL::text END AS link_title,
  o.is_public,
  o.created_at,
  o.updated_at
FROM public.opportunities o
WHERE
  (
    o.action_type = 'external'
    AND COALESCE(o.is_public, false)
    AND NULLIF(BTRIM(o.link_url), '') IS NOT NULL
  )
  OR (
    COALESCE(o.action_type, 'apply') <> 'external'
    AND o.status = 'open'
  )),
    actual AS (SELECT id, title, description, type, status, posted_by, company, location, is_remote, compensation, experience_level, roles, requirements, deadline, start_date, duration, tags, is_featured, action_type, image_url, link_url, link_title, is_public, created_at, updated_at FROM public.opportunities_public_catalog)
  SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(a) FROM actual a)
    OR EXISTS (SELECT to_jsonb(a) FROM actual a EXCEPT SELECT to_jsonb(e) FROM expected e) INTO mismatch;
  IF mismatch THEN RAISE EXCEPTION 'Source/projection mismatch'; END IF;
  SELECT count(*) INTO rows FROM public.opportunities_public_catalog;
  PERFORM set_config('opportunity_test.count', rows::text, true);
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.opportunities_public_catalog'::regclass) THEN
    RAISE EXCEPTION 'Projection RLS disabled';
  END IF;
  IF has_function_privilege('anon', 'private.sync_opportunity_public_catalog()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'private.sync_opportunity_public_catalog()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client trigger execution allowed';
  END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ DECLARE relation_name text; privilege text; BEGIN
  IF (SELECT count(*) FROM public.opportunities_public_browse) <> current_setting('opportunity_test.count')::bigint THEN
    RAISE EXCEPTION 'Anonymous public row mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.opportunities WHERE action_type IS DISTINCT FROM 'external'
    OR NOT COALESCE(is_public, false) OR NULLIF(BTRIM(link_url), '') IS NULL) THEN
    RAISE EXCEPTION 'Anonymous protected source rows allowed';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY['opportunities_public_browse', 'opportunities_public_catalog'] LOOP
    FOREACH privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
      IF has_table_privilege('anon', 'public.' || relation_name, privilege)
        OR has_table_privilege('authenticated', 'public.' || relation_name, privilege) THEN
        RAISE EXCEPTION 'Client projection write grant: % %', relation_name, privilege;
      END IF;
    END LOOP;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunities_public_browse) <> current_setting('opportunity_test.count')::bigint THEN
    RAISE EXCEPTION 'Authenticated public row mismatch';
  END IF;
END $$;
RESET ROLE;
SELECT 'Opportunity browse checks passed' AS result, current_setting('opportunity_test.count')::bigint AS public_teaser_count;
ROLLBACK;
