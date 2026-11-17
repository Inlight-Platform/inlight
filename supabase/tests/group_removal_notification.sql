-- Local-only, rollback-only regression for the installed removal function.
-- Containment is deliberately pinned to reviewed historical function bodies.
-- A changed implementation requires a fresh side-effect review and updated
-- fingerprints before this test can run; never weaken the prerequisite checks.
\set ON_ERROR_STOP on
BEGIN;

-- These checks run before fixture writes. The two historical functions are
-- called as installed; this test never creates or replaces either function.
DO $$
DECLARE
  table_name text;
  required_column record;
BEGIN
  IF current_database() IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'Unexpected database';
  END IF;
  IF pg_catalog.to_regprocedure('public.remove_group_content(uuid,text,uuid)') IS NULL
    OR pg_catalog.to_regprocedure('public.is_scoped_group_admin(uuid,uuid)') IS NULL
    OR pg_catalog.to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Required installed functions are missing';
  END IF;
  IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p
      WHERE p.oid = pg_catalog.to_regprocedure('public.remove_group_content(uuid,text,uuid)'))
      IS DISTINCT FROM 'c15a5bc7547d02fbe8ece2f95d5bc0e6'
    OR (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p
      WHERE p.oid = pg_catalog.to_regprocedure('public.is_scoped_group_admin(uuid,uuid)'))
      IS DISTINCT FROM '542a118b3bb25df323ecd4b8e4dc701d' THEN
    RAISE EXCEPTION 'Installed removal or authorization function needs side-effect review';
  END IF;
  IF pg_catalog.has_parameter_privilege(current_user, 'session_replication_role', 'SET') IS NOT TRUE
    OR pg_catalog.has_function_privilege('authenticated', 'public.remove_group_content(uuid,text,uuid)', 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION 'Fixture isolation or authenticated execution privilege missing';
  END IF;
  FOREACH table_name IN ARRAY ARRAY['auth.users', 'public.groups', 'public.group_admins',
    'public.projects', 'public.project_groups', 'public.project_members',
    'public.project_roles', 'public.project_invitations', 'public.project_recipients', 'public.notifications'] LOOP
    IF pg_catalog.to_regclass(table_name) IS NULL THEN
      RAISE EXCEPTION 'Required fixture table missing: %', table_name;
    END IF;
    -- Replica and always triggers fire during fixture construction even when
    -- ordinary triggers are suppressed by session_replication_role.
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = pg_catalog.to_regclass(table_name)
        AND NOT t.tgisinternal AND t.tgenabled IN ('R', 'A')) THEN
      RAISE EXCEPTION 'Uncontained replica or always trigger on %', table_name;
    END IF;
  END LOOP;
  FOR required_column IN SELECT * FROM (VALUES
    ('auth.users', 'id'), ('auth.users', 'email'), ('auth.users', 'email_confirmed_at'), ('auth.users', 'created_at'),
    ('public.groups', 'id'), ('public.groups', 'slug'), ('public.groups', 'name'), ('public.groups', 'members_can_post'),
    ('public.group_admins', 'group_id'), ('public.group_admins', 'user_id'), ('public.group_admins', 'email'), ('public.group_admins', 'status'),
    ('public.projects', 'id'), ('public.projects', 'creator_id'), ('public.projects', 'title'), ('public.projects', 'slug'), ('public.projects', 'visibility'), ('public.projects', 'is_public'),
    ('public.project_groups', 'project_id'), ('public.project_groups', 'group_id'),
    ('public.project_members', 'project_id'), ('public.project_members', 'user_id'),
    ('public.project_roles', 'id'), ('public.project_roles', 'project_id'), ('public.project_roles', 'role_name'),
    ('public.project_invitations', 'project_role_id'), ('public.project_invitations', 'sender_id'), ('public.project_invitations', 'receiver_id'),
    ('public.project_recipients', 'project_id'),
    ('public.notifications', 'user_id'), ('public.notifications', 'type'), ('public.notifications', 'title'), ('public.notifications', 'body'), ('public.notifications', 'data')
  ) AS required(table_name, column_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = pg_catalog.to_regclass(required_column.table_name)
        AND a.attname = required_column.column_name AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'Required fixture column missing: %.%', required_column.table_name, required_column.column_name;
    END IF;
  END LOOP;
  -- When the real function runs with normal trigger behavior, reject unknown
  -- user triggers on its write targets rather than guessing their effects.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid IN ('public.projects'::regclass, 'public.project_groups'::regclass,
                        'public.project_recipients'::regclass)
      AND NOT t.tgisinternal AND t.tgenabled <> 'D') THEN
    RAISE EXCEPTION 'Removal write-target trigger requires containment review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.notifications'::regclass
      AND t.tgname = 'on_notification_inserted' AND NOT t.tgisinternal
      AND t.tgenabled = 'O')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = 'public.notifications'::regclass AND NOT t.tgisinternal
        AND t.tgenabled <> 'D' AND t.tgname <> 'on_notification_inserted') THEN
    RAISE EXCEPTION 'Notification trigger configuration requires containment review';
  END IF;
END $$;

-- Transactional suppression happens before all fixtures. Failure to disable
-- the known trigger aborts the transaction before any fixture is written.
ALTER TABLE public.notifications DISABLE TRIGGER on_notification_inserted;
SET LOCAL session_replication_role = replica;
CREATE TEMP TABLE removal_notification_fixture (
  creator uuid, admin uuid, member uuid, invitee uuid, group_id uuid,
  project_id uuid, role_id uuid, title text
) ON COMMIT DROP;
GRANT SELECT ON removal_notification_fixture TO authenticated;
INSERT INTO removal_notification_fixture
SELECT gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'Removal notification fixture';

-- Random fixture identifiers and a random slug avoid overwriting existing rows.
INSERT INTO auth.users (id, email, email_confirmed_at, created_at)
SELECT u.id, u.id::text || '@example.test', now(), now()
FROM removal_notification_fixture f
CROSS JOIN LATERAL (VALUES (f.creator), (f.admin), (f.member), (f.invitee)) AS u(id);
INSERT INTO public.groups (id, slug, name, members_can_post)
SELECT group_id, 'notification-test-' || group_id::text, 'Notification test department', true
FROM removal_notification_fixture;
INSERT INTO public.group_admins (group_id, user_id, email, status)
SELECT group_id, admin, admin::text || '@example.test', 'active' FROM removal_notification_fixture;
INSERT INTO public.projects (id, creator_id, title, slug, visibility, is_public)
SELECT project_id, creator, title, 'notification-test-' || project_id::text, 'group', false
FROM removal_notification_fixture;
INSERT INTO public.project_groups (project_id, group_id)
SELECT project_id, group_id FROM removal_notification_fixture;
INSERT INTO public.project_members (project_id, user_id)
SELECT project_id, member FROM removal_notification_fixture;
INSERT INTO public.project_roles (id, project_id, role_name)
SELECT role_id, project_id, 'Fixture role' FROM removal_notification_fixture;
INSERT INTO public.project_invitations (project_role_id, sender_id, receiver_id)
SELECT role_id, creator, invitee FROM removal_notification_fixture;
SET LOCAL session_replication_role = origin;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.notifications n, removal_notification_fixture f
    WHERE n.type = 'department_content_removed' AND n.data->>'content_id' = f.project_id::text) THEN
    RAISE EXCEPTION 'Notification baseline is not clean';
  END IF;
END $$;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT admin::text FROM removal_notification_fixture), true);
SET LOCAL ROLE authenticated;
SELECT public.remove_group_content(group_id, 'project', project_id) FROM removal_notification_fixture;
RESET ROLE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.project_groups pg JOIN removal_notification_fixture f
    ON pg.group_id = f.group_id AND pg.project_id = f.project_id) THEN
    RAISE EXCEPTION 'Project was not removed from the department';
  END IF;
  IF (SELECT count(*) FROM public.notifications n, removal_notification_fixture f
    WHERE n.type = 'department_content_removed' AND n.data->>'content_id' = f.project_id::text) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one project removal notification';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications n, removal_notification_fixture f
    WHERE n.type = 'department_content_removed' AND n.user_id = f.creator
      AND n.data->>'content_type' = 'project' AND n.data->>'content_id' = f.project_id::text
      AND n.data->>'path' = '/projects/' || f.project_id::text
      AND n.body = f.title || ' was removed from the department feed. You, project members, and invitees keep access. Open it to review its audience.') THEN
    RAISE EXCEPTION 'Creator, project reference or notification body differs from expected';
  END IF;
END $$;
ROLLBACK;
