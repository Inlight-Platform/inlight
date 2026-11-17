-- Rollback-only regression. Run only on a separately verified disposable local
-- database with the audience migration installed. The old Bug 13 local DB is
-- not a suitable target. No migration is applied by this test.
-- Replica mode suppresses ordinary fixture triggers, but not replica/always
-- triggers. Review all side effects and external-delivery containment before execution.
-- Network/specific recipient read access is not established by these tests.
\set ON_ERROR_STOP on
BEGIN;

-- Identify the actual immediate recipient FK, rather than guessing its name.
CREATE TEMP TABLE audience_recipient_fk ON COMMIT DROP AS
SELECT c.conname, n.nspname AS schema_name, t.relname AS table_name
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE c.contype = 'f' AND c.conrelid = 'public.project_recipients'::regclass
  AND c.confrelid = 'auth.users'::regclass AND c.convalidated AND NOT c.condeferrable
  AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = c.conrelid AND a.attname = 'recipient_id' AND NOT a.attisdropped)]::smallint[]
  AND c.confkey = ARRAY[(SELECT a.attnum FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = c.confrelid AND a.attname = 'id' AND NOT a.attisdropped)]::smallint[];
GRANT SELECT ON audience_recipient_fk TO authenticated;

DO $$ BEGIN
  IF pg_catalog.to_regprocedure('public.set_project_audience(uuid,text,uuid,uuid[])') IS NULL
    OR pg_catalog.to_regprocedure('public.remove_group_content(uuid,text,uuid)') IS NULL
    OR pg_catalog.to_regprocedure('public.send_notification_email()') IS NULL THEN
    RAISE EXCEPTION 'Required installed functions are missing';
  END IF;
  IF (SELECT count(*) FROM audience_recipient_fk) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one validated immediate recipient foreign key';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id IN
      ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',
       'a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004',
       'a1000000-0000-4000-8000-000000000099')
      OR lower(btrim(u.email)) IN ('audience-owner@example.invalid','audience-member@example.invalid',
        'audience-invitee@example.invalid','audience-outsider@example.invalid'))
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id IN
      ('a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002')
      OR g.slug IN ('audience-old-link-fixture','audience-new-link-fixture'))
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id IN
      ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002',
       'a3000000-0000-4000-8000-000000000099')
      OR p.slug IN ('audience-main-fixture','audience-other-fixture'))
    OR EXISTS (SELECT 1 FROM public.project_roles r WHERE r.id='a4000000-0000-4000-8000-000000000001')
    OR EXISTS (SELECT 1 FROM public.project_invitations i WHERE i.id='a5000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Fixture collision';
  END IF;
END $$;

CREATE TEMP TABLE audience_definition_baseline ON COMMIT DROP AS
SELECT p.oid::regprocedure::text AS signature, pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
WHERE p.oid IN ('public.remove_group_content(uuid,text,uuid)'::regprocedure,
                'public.send_notification_email()'::regprocedure);

-- Ordinary triggers are suppressed during fixtures; replica/always triggers
-- can still fire. This setting requires a role allowed to set it.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (id, email, created_at) VALUES
 ('a1000000-0000-4000-8000-000000000001','audience-owner@example.invalid',now()),
 ('a1000000-0000-4000-8000-000000000002','audience-member@example.invalid',now()),
 ('a1000000-0000-4000-8000-000000000003','audience-invitee@example.invalid',now()),
 ('a1000000-0000-4000-8000-000000000004','audience-outsider@example.invalid',now());
INSERT INTO public.groups (id,slug,name,is_listed,members_can_post) VALUES
 ('a2000000-0000-4000-8000-000000000001','audience-old-link-fixture','Old department',false,true),
 ('a2000000-0000-4000-8000-000000000002','audience-new-link-fixture','New department',false,true);
INSERT INTO public.group_members (group_id,user_id,status) VALUES
 ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','active');
INSERT INTO public.projects (id,creator_id,title,slug,visibility,is_public) VALUES
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Audience fixture','audience-main-fixture','group',false),
 ('a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','Other fixture','audience-other-fixture','public',true);
INSERT INTO public.project_groups (project_id,group_id) VALUES
 ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001');
INSERT INTO public.project_recipients (project_id,recipient_id) VALUES
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003'),
 ('a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003');
INSERT INTO public.project_members (project_id,user_id) VALUES
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
INSERT INTO public.project_roles (id,project_id,role_name) VALUES
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Fixture role');
INSERT INTO public.project_invitations (id,project_role_id,sender_id,receiver_id) VALUES
 ('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003');
SET LOCAL session_replication_role = origin;

CREATE TEMP TABLE audience_other_project ON COMMIT DROP AS
SELECT pg_catalog.to_jsonb(p) AS row_data FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000002';
CREATE TEMP TABLE audience_members ON COMMIT DROP AS
SELECT pg_catalog.to_jsonb(m) AS row_data FROM public.project_members m WHERE m.project_id='a3000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE audience_invitations ON COMMIT DROP AS
SELECT pg_catalog.to_jsonb(i) AS row_data FROM public.project_invitations i WHERE i.id='a5000000-0000-4000-8000-000000000001';

-- Anonymous execution must be denied even with a forged subject.
SELECT pg_catalog.set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true) \gset
SET LOCAL ROLE anon;
DO $$ DECLARE v_denied boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','public',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Anonymous execution was not denied'; END IF;
END $$;
RESET ROLE;

SELECT pg_catalog.set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true) \gset
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_denied boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','public',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Project unavailable or unauthorized'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Noncreator was not denied'; END IF;
END $$;
RESET ROLE;

SELECT pg_catalog.set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true) \gset
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_denied boolean; BEGIN
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000099','public',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Project unavailable or unauthorized'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Missing project was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','unknown',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid audience arguments'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Invalid audience was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid audience arguments'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Empty specific audience was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY[NULL]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid audience arguments'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Null recipient was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY['a1000000-0000-4000-8000-000000000003'::uuid,'a1000000-0000-4000-8000-000000000003'::uuid]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid audience arguments'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Duplicate recipient was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','group',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid or unauthorized group'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Missing group was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','public','a2000000-0000-4000-8000-000000000002',ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid audience arguments'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Invalid group combination was not denied'; END IF;
  v_denied := false;
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','group','a2000000-0000-4000-8000-000000000001',ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_denied := SQLERRM = 'Invalid or unauthorized group'; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Unauthorized group was not denied'; END IF;
END $$;

-- Exercise rollback while both an old link and a recipient exist. The invalid
-- recipient fails at INSERT, after both deletes and the project UPDATE.
DO $$ DECLARE v_failed boolean := false; v_constraint text; v_schema text; v_table text; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY['a1000000-0000-4000-8000-000000000099'::uuid]);
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME, v_schema = SCHEMA_NAME, v_table = TABLE_NAME;
    SELECT EXISTS (SELECT 1 FROM audience_recipient_fk f WHERE f.conname = v_constraint AND f.schema_name = v_schema AND f.table_name = v_table) INTO v_failed;
    IF NOT v_failed THEN RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Expected late failure did not occur'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='group' AND p.is_public IS FALSE)
    OR (SELECT count(*) FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001') <> 1
    OR NOT EXISTS (SELECT 1 FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001' AND g.group_id='a2000000-0000-4000-8000-000000000001')
    OR (SELECT count(*) FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001') <> 1
    OR NOT EXISTS (SELECT 1 FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001' AND r.recipient_id='a1000000-0000-4000-8000-000000000003')
  THEN RAISE EXCEPTION 'Late failure did not restore all prior audience data'; END IF;
END $$;

-- A BEFORE UPDATE trigger suppresses the target row, simulating a zero-row
-- update. It is disabled after the assertion and disappears on rollback.
CREATE FUNCTION pg_temp.suppress_audience_fixture_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
CREATE TRIGGER audience_fixture_suppress_update BEFORE UPDATE ON public.projects
  FOR EACH ROW WHEN (OLD.id = 'a3000000-0000-4000-8000-000000000001'::uuid)
  EXECUTE FUNCTION pg_temp.suppress_audience_fixture_update();
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_failed boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','public',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_failed := SQLERRM = 'Project unavailable or unauthorized'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Zero-row update was not rejected'; END IF;
END $$;
RESET ROLE;
ALTER TABLE public.projects DISABLE TRIGGER audience_fixture_suppress_update;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='group' AND p.is_public IS FALSE)
    OR NOT EXISTS (SELECT 1 FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001' AND g.group_id='a2000000-0000-4000-8000-000000000001')
    OR NOT EXISTS (SELECT 1 FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001' AND r.recipient_id='a1000000-0000-4000-8000-000000000003')
  THEN RAISE EXCEPTION 'Zero-row update did not preserve audience'; END IF;
END $$;
-- Snapshot the full prior audience; scoped triggers simulate each child write
-- being suppressed. All trigger DDL and data changes roll back with the test.
CREATE TEMP TABLE audience_before_suppression ON COMMIT DROP AS
SELECT 'project'::text AS kind, pg_catalog.to_jsonb(p) AS row_data FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'group', pg_catalog.to_jsonb(g) FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001'
UNION ALL SELECT 'recipient', pg_catalog.to_jsonb(r) FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001';
CREATE FUNCTION pg_temp.suppress_audience_child() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF pg_catalog.current_setting('test.suppress_audience_child', true) = TG_TABLE_NAME || ':' || TG_OP THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE FUNCTION pg_temp.assert_suppressed_audience_rollback() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF EXISTS (
    WITH actual AS (
      SELECT 'project'::text AS kind,pg_catalog.to_jsonb(p) AS row_data FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001'
      UNION ALL SELECT 'group',pg_catalog.to_jsonb(g) FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001'
      UNION ALL SELECT 'recipient',pg_catalog.to_jsonb(r) FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001'
    )
    SELECT 1 FROM (
      (SELECT kind,row_data FROM audience_before_suppression EXCEPT SELECT kind,row_data FROM actual)
      UNION ALL
      (SELECT kind,row_data FROM actual EXCEPT SELECT kind,row_data FROM audience_before_suppression)
    ) AS differences
  ) THEN RAISE EXCEPTION 'Suppressed write did not roll back complete audience'; END IF;
END $$;
CREATE TRIGGER audience_suppress_group_delete BEFORE DELETE ON public.project_groups FOR EACH ROW
  WHEN (OLD.project_id = 'a3000000-0000-4000-8000-000000000001'::uuid) EXECUTE FUNCTION pg_temp.suppress_audience_child();
CREATE TRIGGER audience_suppress_group_insert BEFORE INSERT ON public.project_groups FOR EACH ROW
  WHEN (NEW.project_id = 'a3000000-0000-4000-8000-000000000001'::uuid) EXECUTE FUNCTION pg_temp.suppress_audience_child();
CREATE TRIGGER audience_suppress_recipient_delete BEFORE DELETE ON public.project_recipients FOR EACH ROW
  WHEN (OLD.project_id = 'a3000000-0000-4000-8000-000000000001'::uuid) EXECUTE FUNCTION pg_temp.suppress_audience_child();
CREATE TRIGGER audience_suppress_recipient_insert BEFORE INSERT ON public.project_recipients FOR EACH ROW
  WHEN (NEW.project_id = 'a3000000-0000-4000-8000-000000000001'::uuid) EXECUTE FUNCTION pg_temp.suppress_audience_child();

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('test.suppress_audience_child','project_groups:DELETE',true) \gset
DO $$ DECLARE v_failed boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','public',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_failed := SQLERRM = 'Audience state mismatch'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Suppressed group DELETE was not rejected'; END IF;
END $$;
RESET ROLE;
SELECT pg_temp.assert_suppressed_audience_rollback();

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('test.suppress_audience_child','project_recipients:DELETE',true) \gset
DO $$ DECLARE v_failed boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','public',NULL,ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_failed := SQLERRM = 'Audience state mismatch'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Suppressed recipient DELETE was not rejected'; END IF;
END $$;
RESET ROLE;
SELECT pg_temp.assert_suppressed_audience_rollback();

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('test.suppress_audience_child','project_groups:INSERT',true) \gset
DO $$ DECLARE v_failed boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','group','a2000000-0000-4000-8000-000000000002',ARRAY[]::uuid[]);
  EXCEPTION WHEN raise_exception THEN v_failed := SQLERRM = 'Audience state mismatch'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Suppressed group INSERT was not rejected'; END IF;
END $$;
RESET ROLE;
SELECT pg_temp.assert_suppressed_audience_rollback();

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('test.suppress_audience_child','project_recipients:INSERT',true) \gset
DO $$ DECLARE v_failed boolean := false; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY['a1000000-0000-4000-8000-000000000003'::uuid]);
  EXCEPTION WHEN raise_exception THEN v_failed := SQLERRM = 'Audience state mismatch'; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Suppressed recipient INSERT was not rejected'; END IF;
END $$;
RESET ROLE;
SELECT pg_temp.assert_suppressed_audience_rollback();
SELECT pg_catalog.set_config('test.suppress_audience_child','',true) \gset
SET LOCAL ROLE authenticated;

-- The old link is not visible to this creator through the group-link policy.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001'
    AND g.group_id='a2000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Old-link fixture is not hidden; review policies';
  END IF;
END $$;
SELECT public.set_project_audience('a3000000-0000-4000-8000-000000000001','group','a2000000-0000-4000-8000-000000000002',ARRAY[]::uuid[]);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001') <> 1
    OR NOT EXISTS (SELECT 1 FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001' AND g.group_id='a2000000-0000-4000-8000-000000000002')
    OR EXISTS (SELECT 1 FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001')
    OR NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='group' AND p.is_public IS FALSE)
  THEN RAISE EXCEPTION 'Group audience or old-link replacement failed'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY['a1000000-0000-4000-8000-000000000003'::uuid]);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='specific' AND p.is_public IS FALSE)
    OR NOT EXISTS (SELECT 1 FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001' AND r.recipient_id='a1000000-0000-4000-8000-000000000003')
    OR EXISTS (SELECT 1 FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001')
  THEN RAISE EXCEPTION 'Specific audience save failed'; END IF;
END $$;

-- An invalid recipient reaches the FK after deletes and project update. The
-- exception subtransaction must restore every old audience row and field.
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_failed boolean := false; v_constraint text; v_schema text; v_table text; BEGIN
  BEGIN PERFORM public.set_project_audience('a3000000-0000-4000-8000-000000000001','specific',NULL,ARRAY['a1000000-0000-4000-8000-000000000099'::uuid]);
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME, v_schema = SCHEMA_NAME, v_table = TABLE_NAME;
    SELECT EXISTS (SELECT 1 FROM audience_recipient_fk f WHERE f.conname = v_constraint AND f.schema_name = v_schema AND f.table_name = v_table) INTO v_failed;
    IF NOT v_failed THEN RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Expected late failure did not occur'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='specific' AND p.is_public IS FALSE)
    OR (SELECT count(*) FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001') <> 1
    OR NOT EXISTS (SELECT 1 FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001' AND r.recipient_id='a1000000-0000-4000-8000-000000000003')
    OR EXISTS (SELECT 1 FROM public.project_groups g WHERE g.project_id='a3000000-0000-4000-8000-000000000001')
  THEN RAISE EXCEPTION 'Late failure did not restore prior audience'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT public.set_project_audience('a3000000-0000-4000-8000-000000000001','public',NULL,ARRAY[]::uuid[]);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='public' AND p.is_public IS TRUE)
    OR EXISTS (SELECT 1 FROM public.project_recipients r WHERE r.project_id='a3000000-0000-4000-8000-000000000001')
  THEN RAISE EXCEPTION 'Public audience save failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.set_project_audience('a3000000-0000-4000-8000-000000000001','network',NULL,ARRAY[]::uuid[]);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='network' AND p.is_public IS FALSE)
  THEN RAISE EXCEPTION 'Network audience save failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.set_project_audience('a3000000-0000-4000-8000-000000000001','private',NULL,ARRAY[]::uuid[]);
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001' AND p.visibility='private' AND p.is_public IS FALSE)
  THEN RAISE EXCEPTION 'Private audience save failed'; END IF;
END $$;

-- Test effective access as the member, not just the membership row.
SELECT pg_catalog.set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true) \gset
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Existing project member cannot read private project';
  END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF EXISTS ((SELECT row_data FROM audience_members EXCEPT SELECT pg_catalog.to_jsonb(m) FROM public.project_members m WHERE m.project_id='a3000000-0000-4000-8000-000000000001') UNION ALL
             (SELECT pg_catalog.to_jsonb(m) FROM public.project_members m WHERE m.project_id='a3000000-0000-4000-8000-000000000001' EXCEPT SELECT row_data FROM audience_members))
    OR EXISTS ((SELECT row_data FROM audience_invitations EXCEPT SELECT pg_catalog.to_jsonb(i) FROM public.project_invitations i WHERE i.id='a5000000-0000-4000-8000-000000000001') UNION ALL
               (SELECT pg_catalog.to_jsonb(i) FROM public.project_invitations i WHERE i.id='a5000000-0000-4000-8000-000000000001' EXCEPT SELECT row_data FROM audience_invitations))
    OR EXISTS ((SELECT row_data FROM audience_other_project EXCEPT SELECT pg_catalog.to_jsonb(p) FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000002') UNION ALL
               (SELECT pg_catalog.to_jsonb(p) FROM public.projects p WHERE p.id='a3000000-0000-4000-8000-000000000002' EXCEPT SELECT row_data FROM audience_other_project))
    OR NOT EXISTS (SELECT 1 FROM public.project_groups WHERE project_id='a3000000-0000-4000-8000-000000000002' AND group_id='a2000000-0000-4000-8000-000000000001')
    OR NOT EXISTS (SELECT 1 FROM public.project_recipients WHERE project_id='a3000000-0000-4000-8000-000000000002' AND recipient_id='a1000000-0000-4000-8000-000000000003')
    OR EXISTS (SELECT 1 FROM audience_definition_baseline b
      WHERE b.definition IS DISTINCT FROM pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(b.signature)))
  THEN RAISE EXCEPTION 'Unrelated data, membership, invitations or existing function definitions changed'; END IF;
END $$;
ROLLBACK;
