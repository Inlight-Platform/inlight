-- PRECONDITIONS: invoke only through a separately verified exact local Docker
-- container ID and its Unix socket; a database name alone proves no locality.
-- The operator accepts that freshly generated synthetic local fixture invitation
-- tokens may reach local database logs. Never use or print real account tokens
-- or credentials. This acceptance does not establish audit logging status.
-- INCOMPLETE UNTIL RUN AND REVIEWED. Local database only; never hosted.
-- Setup commits synthetic rows. Run each case once, in order; never retry a
-- failed case without inspecting state. Cleanup is intentionally UNIMPLEMENTED.
-- No guard bypass or automatic cleanup. Obtain separate approval for deletion.
-- Source baseline: is_group_faculty permits platform admins and is unchanged.
-- Token queries use psql gset without output; logging settings are not changed.
\set ON_ERROR_STOP on
\set ECHO none
\set QUIET 1
\if :{?setup}
\set bug13_present_setup 1
\else
\set bug13_present_setup 0
\set setup 0
\endif
\if :{?case_a_a}
\set bug13_present_case_a_a 1
\else
\set bug13_present_case_a_a 0
\set case_a_a 0
\endif
\if :{?case_a_b}
\set bug13_present_case_a_b 1
\else
\set bug13_present_case_a_b 0
\set case_a_b 0
\endif
\if :{?case_b_a}
\set bug13_present_case_b_a 1
\else
\set bug13_present_case_b_a 0
\set case_b_a 0
\endif
\if :{?case_b_b}
\set bug13_present_case_b_b 1
\else
\set bug13_present_case_b_b 0
\set case_b_b 0
\endif
\if :{?case_c_a}
\set bug13_present_case_c_a 1
\else
\set bug13_present_case_c_a 0
\set case_c_a 0
\endif
\if :{?case_c_b}
\set bug13_present_case_c_b 1
\else
\set bug13_present_case_c_b 0
\set case_c_b 0
\endif
\if :{?verify_a}
\set bug13_present_verify_a 1
\else
\set bug13_present_verify_a 0
\set verify_a 0
\endif
\if :{?verify_b}
\set bug13_present_verify_b 1
\else
\set bug13_present_verify_b 0
\set verify_b 0
\endif
\if :{?verify_c}
\set bug13_present_verify_c 1
\else
\set bug13_present_verify_c 0
\set verify_c 0
\endif
\if :{?cleanup}
\set bug13_present_cleanup 1
\else
\set bug13_present_cleanup 0
\set cleanup 0
\endif
SELECT (:'bug13_present_setup'::integer + :'bug13_present_case_a_a'::integer + :'bug13_present_case_a_b'::integer + :'bug13_present_case_b_a'::integer + :'bug13_present_case_b_b'::integer + :'bug13_present_case_c_a'::integer + :'bug13_present_case_c_b'::integer + :'bug13_present_verify_a'::integer + :'bug13_present_verify_b'::integer + :'bug13_present_verify_c'::integer + :'bug13_present_cleanup'::integer = 1 AND
    (:'bug13_present_setup' = '0' OR :'setup' = '1') AND
    (:'bug13_present_case_a_a' = '0' OR :'case_a_a' = '1') AND
    (:'bug13_present_case_a_b' = '0' OR :'case_a_b' = '1') AND
    (:'bug13_present_case_b_a' = '0' OR :'case_b_a' = '1') AND
    (:'bug13_present_case_b_b' = '0' OR :'case_b_b' = '1') AND
    (:'bug13_present_case_c_a' = '0' OR :'case_c_a' = '1') AND
    (:'bug13_present_case_c_b' = '0' OR :'case_c_b' = '1') AND
    (:'bug13_present_verify_a' = '0' OR :'verify_a' = '1') AND
    (:'bug13_present_verify_b' = '0' OR :'verify_b' = '1') AND
    (:'bug13_present_verify_c' = '0' OR :'verify_c' = '1') AND
    (:'bug13_present_cleanup' = '0' OR :'cleanup' = '1')) AS bug13_mode_valid \gset
\if :bug13_mode_valid
\else
DO $$ BEGIN RAISE EXCEPTION 'Choose exactly one explicitly enabled mode with value 1'; END $$;
\endif
\if :{?local_target_confirmed}
SELECT (:'local_target_confirmed' = '1') AS bug13_target_confirmed \gset
\else
\set bug13_target_confirmed false
\endif
\if :bug13_target_confirmed
\else
DO $$ BEGIN RAISE EXCEPTION 'External Docker target identity confirmation required'; END $$;
\endif
DO $$ BEGIN
 IF pg_catalog.inet_server_addr() IS NOT NULL OR pg_catalog.current_database() IS DISTINCT FROM 'postgres'
    OR session_user IS DISTINCT FROM 'postgres' THEN
   RAISE EXCEPTION 'Expected local Unix socket and reviewed database role; external container identity must also be checked';
 END IF;
END $$;
\if :setup
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '10s';
DO $$
DECLARE
  v_users uuid[] := ARRAY['61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003']::uuid[];
  v_groups uuid[] := ARRAY['62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000003']::uuid[];
  v_admins uuid[] := ARRAY['63000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000004']::uuid[];
  v_invites uuid[] := ARRAY['64000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000003']::uuid[];
  v_emails text[] := ARRAY['bug13-remover-20261109@example.invalid','bug13-claimant-20261109@example.invalid','bug13-successor-20261109@example.invalid'];
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id=ANY(v_users) OR lower(btrim(u.email))=ANY(v_emails))
    OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.user_id=ANY(v_users) OR lower(btrim(p.email))=ANY(v_emails))
    OR EXISTS (SELECT 1 FROM public.groups AS g WHERE g.id=ANY(v_groups) OR g.slug IN ('bug13-removal-first-20261109','bug13-claim-first-successor-20261109','bug13-claim-first-last-20261109'))
    OR EXISTS (SELECT 1 FROM public.group_admins AS ga WHERE ga.id=ANY(v_admins) OR ga.group_id=ANY(v_groups) OR ga.user_id=ANY(v_users) OR lower(btrim(ga.email))=ANY(v_emails))
    OR EXISTS (SELECT 1 FROM public.group_admin_invites AS gi WHERE gi.id=ANY(v_invites) OR gi.admin_id=ANY(v_admins) OR gi.claimed_by=ANY(v_users))
    OR EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.group_id=ANY(v_groups) OR gm.user_id=ANY(v_users))
    OR EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id=ANY(v_users))
    OR EXISTS (SELECT 1 FROM public.group_invites AS gvi WHERE gvi.group_id=ANY(v_groups) OR lower(btrim(gvi.email))=ANY(v_emails) OR gvi.accepted_by=ANY(v_users))
    OR EXISTS (SELECT 1 FROM public.platform_invites AS pi WHERE lower(btrim(pi.email))=ANY(v_emails) OR pi.accepted_by=ANY(v_users))
  THEN RAISE EXCEPTION 'Fixture collision; setup refused'; END IF;
END $$;
INSERT INTO auth.users (id,email,email_confirmed_at,created_at) VALUES
 ('61000000-0000-4000-8000-000000000001','bug13-remover-20261109@example.invalid',now(),now()),
 ('61000000-0000-4000-8000-000000000002','bug13-claimant-20261109@example.invalid',now(),now()),
 ('61000000-0000-4000-8000-000000000003','bug13-successor-20261109@example.invalid',now(),now());
INSERT INTO public.user_roles (user_id,role) VALUES ('61000000-0000-4000-8000-000000000001','admin');
INSERT INTO public.groups (id,slug,name,is_listed,faculty_owner_id) VALUES
 ('62000000-0000-4000-8000-000000000001','bug13-removal-first-20261109','Bug 13 removal first',false,NULL),
 ('62000000-0000-4000-8000-000000000002','bug13-claim-first-successor-20261109','Bug 13 successor',false,NULL),
 ('62000000-0000-4000-8000-000000000003','bug13-claim-first-last-20261109','Bug 13 last admin',false,NULL);
INSERT INTO public.group_admins (id,group_id,user_id,email,status) VALUES
 ('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001',NULL,'bug13-claimant-20261109@example.invalid','pending'),
 ('63000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000002',NULL,'bug13-claimant-20261109@example.invalid','pending'),
 ('63000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000003',NULL,'bug13-claimant-20261109@example.invalid','pending'),
 ('63000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003','bug13-successor-20261109@example.invalid','active');
INSERT INTO public.group_admin_invites (id,admin_id) VALUES
 ('64000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001'),
 ('64000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000002'),
 ('64000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000003');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.group_admins AS ga WHERE ga.id IN ('63000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000003') AND ga.status='pending' AND ga.user_id IS NULL) <> 3
 OR (SELECT count(*) FROM public.group_admin_invites AS gi WHERE gi.id IN ('64000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000003') AND gi.claimed_at IS NULL AND gi.claimed_by IS NULL) <> 3
 OR NOT EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.group_id='62000000-0000-4000-8000-000000000002' AND gm.user_id='61000000-0000-4000-8000-000000000003' AND gm.status='active')
 OR EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.user_id IN ('61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002'))
 OR EXISTS (SELECT 1 FROM public.group_admins AS ga WHERE ga.user_id='61000000-0000-4000-8000-000000000001')
 OR (SELECT count(*) FROM public.user_roles AS ur WHERE ur.user_id IN ('61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003')) <> 1
 THEN RAISE EXCEPTION 'Fixture baseline mismatch'; END IF;
END $$;
COMMIT;
\echo 'Setup committed synthetic fixtures; no cleanup was performed.'
\elif :case_a_a
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '40s';
SET LOCAL lock_timeout = '30s';
SET LOCAL application_name = 'bug13-a-a';
DO $$ BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.current_setting('application_name'), 0)) THEN
  RAISE EXCEPTION 'Competing session owns this harness name';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM pg_catalog.pg_stat_clear_snapshot();
 IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-a-a') <> 1 THEN
  RAISE EXCEPTION 'Competing harness sessions detected for bug13-a-a';
 END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","email":"bug13-remover-20261109@example.invalid"}', true) \gset
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true) \gset
SET LOCAL ROLE authenticated;
SELECT public.remove_group_admin('63000000-0000-4000-8000-000000000001');
RESET ROLE;
DO $$ DECLARE deadline timestamptz := clock_timestamp() + interval '20 seconds'; BEGIN
 RAISE NOTICE 'First transaction holds its lock; start the matching B session';
 LOOP
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-a-a') <> 1 THEN
   RAISE EXCEPTION 'Competing harness session names detected for case a';
  END IF;
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-a-b') > 1 THEN
   RAISE EXCEPTION 'Competing harness session names detected for case a';
  END IF;
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity a
    WHERE a.application_name = 'bug13-a-b' AND a.pid <> pg_backend_pid()
      AND pg_backend_pid() = ANY(pg_catalog.pg_blocking_pids(a.pid))) THEN
    RAISE NOTICE 'Observed matching B blocked by this transaction'; EXIT;
  END IF;
  IF clock_timestamp() >= deadline THEN RAISE EXCEPTION 'No matching blocking evidence before deadline'; END IF;
  PERFORM pg_catalog.pg_sleep(0.1);
 END LOOP;
END $$;
COMMIT;
\elif :case_a_b
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '40s';
SET LOCAL lock_timeout = '30s';
SET LOCAL application_name = 'bug13-a-b';
DO $$ BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.current_setting('application_name'), 0)) THEN
  RAISE EXCEPTION 'Competing session owns this harness name';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM pg_catalog.pg_stat_clear_snapshot();
 IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-a-b') <> 1 THEN
  RAISE EXCEPTION 'Competing harness sessions detected for bug13-a-b';
 END IF;
END $$;
SELECT gi.token AS bug13_invite_token FROM public.group_admin_invites AS gi WHERE gi.id='64000000-0000-4000-8000-000000000001' \gset
SELECT set_config('bug13.invite_token', :'bug13_invite_token', true) \gset
\unset bug13_invite_token
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000002","email":"bug13-claimant-20261109@example.invalid"}', true) \gset
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true) \gset
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result := public.claim_invites_on_signup(NULL, current_setting('bug13.invite_token'));
 IF result->>'group_admin_invite_status' IS DISTINCT FROM 'unavailable' OR (result->>'group_admin_invites_claimed')::integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Unexpected claim result: %', result->>'group_admin_invite_status'; END IF;
END $$;
COMMIT;
\elif :case_b_a
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '40s';
SET LOCAL lock_timeout = '30s';
SET LOCAL application_name = 'bug13-b-a';
DO $$ BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.current_setting('application_name'), 0)) THEN
  RAISE EXCEPTION 'Competing session owns this harness name';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM pg_catalog.pg_stat_clear_snapshot();
 IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-b-a') <> 1 THEN
  RAISE EXCEPTION 'Competing harness sessions detected for bug13-b-a';
 END IF;
END $$;
SELECT gi.token AS bug13_invite_token FROM public.group_admin_invites AS gi WHERE gi.id='64000000-0000-4000-8000-000000000002' \gset
SELECT set_config('bug13.invite_token', :'bug13_invite_token', true) \gset
\unset bug13_invite_token
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000002","email":"bug13-claimant-20261109@example.invalid"}', true) \gset
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true) \gset
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result := public.claim_invites_on_signup(NULL, current_setting('bug13.invite_token'));
 IF result->>'group_admin_invite_status' IS DISTINCT FROM 'claimed' OR (result->>'group_admin_invites_claimed')::integer IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Unexpected claim result: %', result->>'group_admin_invite_status'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE deadline timestamptz := clock_timestamp() + interval '20 seconds'; BEGIN
 RAISE NOTICE 'First transaction holds its lock; start the matching B session';
 LOOP
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-b-a') <> 1 THEN
   RAISE EXCEPTION 'Competing harness session names detected for case b';
  END IF;
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-b-b') > 1 THEN
   RAISE EXCEPTION 'Competing harness session names detected for case b';
  END IF;
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity a
    WHERE a.application_name = 'bug13-b-b' AND a.pid <> pg_backend_pid()
      AND pg_backend_pid() = ANY(pg_catalog.pg_blocking_pids(a.pid))) THEN
    RAISE NOTICE 'Observed matching B blocked by this transaction'; EXIT;
  END IF;
  IF clock_timestamp() >= deadline THEN RAISE EXCEPTION 'No matching blocking evidence before deadline'; END IF;
  PERFORM pg_catalog.pg_sleep(0.1);
 END LOOP;
END $$;
COMMIT;
\elif :case_b_b
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '40s';
SET LOCAL lock_timeout = '30s';
SET LOCAL application_name = 'bug13-b-b';
DO $$ BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.current_setting('application_name'), 0)) THEN
  RAISE EXCEPTION 'Competing session owns this harness name';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM pg_catalog.pg_stat_clear_snapshot();
 IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-b-b') <> 1 THEN
  RAISE EXCEPTION 'Competing harness sessions detected for bug13-b-b';
 END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","email":"bug13-remover-20261109@example.invalid"}', true) \gset
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true) \gset
SET LOCAL ROLE authenticated;
SELECT public.remove_group_admin('63000000-0000-4000-8000-000000000002');
COMMIT;
\elif :case_c_a
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '40s';
SET LOCAL lock_timeout = '30s';
SET LOCAL application_name = 'bug13-c-a';
DO $$ BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.current_setting('application_name'), 0)) THEN
  RAISE EXCEPTION 'Competing session owns this harness name';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM pg_catalog.pg_stat_clear_snapshot();
 IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-c-a') <> 1 THEN
  RAISE EXCEPTION 'Competing harness sessions detected for bug13-c-a';
 END IF;
END $$;
SELECT gi.token AS bug13_invite_token FROM public.group_admin_invites AS gi WHERE gi.id='64000000-0000-4000-8000-000000000003' \gset
SELECT set_config('bug13.invite_token', :'bug13_invite_token', true) \gset
\unset bug13_invite_token
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000002","email":"bug13-claimant-20261109@example.invalid"}', true) \gset
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true) \gset
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result := public.claim_invites_on_signup(NULL, current_setting('bug13.invite_token'));
 IF result->>'group_admin_invite_status' IS DISTINCT FROM 'claimed' OR (result->>'group_admin_invites_claimed')::integer IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Unexpected claim result: %', result->>'group_admin_invite_status'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE deadline timestamptz := clock_timestamp() + interval '20 seconds'; BEGIN
 RAISE NOTICE 'First transaction holds its lock; start the matching B session';
 LOOP
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-c-a') <> 1 THEN
   RAISE EXCEPTION 'Competing harness session names detected for case c';
  END IF;
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-c-b') > 1 THEN
   RAISE EXCEPTION 'Competing harness session names detected for case c';
  END IF;
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity a
    WHERE a.application_name = 'bug13-c-b' AND a.pid <> pg_backend_pid()
      AND pg_backend_pid() = ANY(pg_catalog.pg_blocking_pids(a.pid))) THEN
    RAISE NOTICE 'Observed matching B blocked by this transaction'; EXIT;
  END IF;
  IF clock_timestamp() >= deadline THEN RAISE EXCEPTION 'No matching blocking evidence before deadline'; END IF;
  PERFORM pg_catalog.pg_sleep(0.1);
 END LOOP;
END $$;
COMMIT;
\elif :case_c_b
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '40s';
SET LOCAL lock_timeout = '30s';
SET LOCAL application_name = 'bug13-c-b';
DO $$ BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.current_setting('application_name'), 0)) THEN
  RAISE EXCEPTION 'Competing session owns this harness name';
 END IF;
END $$;
DO $$ BEGIN
 PERFORM pg_catalog.pg_stat_clear_snapshot();
 IF (SELECT count(*) FROM pg_catalog.pg_stat_activity AS sa WHERE sa.application_name = 'bug13-c-b') <> 1 THEN
  RAISE EXCEPTION 'Competing harness sessions detected for bug13-c-b';
 END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","email":"bug13-remover-20261109@example.invalid"}', true) \gset
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true) \gset
SET LOCAL ROLE authenticated;
DO $$ DECLARE state text; message text; rejected boolean := false; BEGIN
 BEGIN
  PERFORM public.remove_group_admin('63000000-0000-4000-8000-000000000003');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE, message = MESSAGE_TEXT;
  IF state IS DISTINCT FROM 'P0001' OR message IS DISTINCT FROM 'Another confirmed active admin is required before removing this admin or deleting their account' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Expected last-admin rejection was absent'; END IF;
END $$;
ROLLBACK;
\elif :verify_a
BEGIN READ ONLY ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '20s';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.group_admins AS ga WHERE ga.id='63000000-0000-4000-8000-000000000001')
 OR EXISTS (SELECT 1 FROM public.group_admin_invites AS gi WHERE gi.id='64000000-0000-4000-8000-000000000001')
 OR EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.group_id='62000000-0000-4000-8000-000000000001' AND gm.user_id='61000000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'Case A final state differs'; END IF;
END $$;
COMMIT;
\echo 'Case A read-only final state assertions completed.'
\elif :verify_b
BEGIN READ ONLY ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '20s';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.group_admins AS ga WHERE ga.id='63000000-0000-4000-8000-000000000002')
 OR EXISTS (SELECT 1 FROM public.group_admin_invites AS gi WHERE gi.id='64000000-0000-4000-8000-000000000002')
 OR NOT EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.group_id='62000000-0000-4000-8000-000000000002' AND gm.user_id='61000000-0000-4000-8000-000000000002' AND gm.status='active')
 OR NOT EXISTS (SELECT 1 FROM public.group_admins AS ga WHERE ga.id='63000000-0000-4000-8000-000000000004' AND ga.group_id='62000000-0000-4000-8000-000000000002' AND ga.user_id='61000000-0000-4000-8000-000000000003' AND ga.status='active')
 OR NOT EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.group_id='62000000-0000-4000-8000-000000000002' AND gm.user_id='61000000-0000-4000-8000-000000000003' AND gm.status='active')
 THEN RAISE EXCEPTION 'Case B final state differs'; END IF;
END $$;
COMMIT;
\echo 'Case B read-only final state assertions completed.'
\elif :verify_c
BEGIN READ ONLY ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '20s';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.group_admins AS ga WHERE ga.id='63000000-0000-4000-8000-000000000003' AND ga.group_id='62000000-0000-4000-8000-000000000003' AND ga.user_id='61000000-0000-4000-8000-000000000002' AND ga.status='active')
 OR NOT EXISTS (SELECT 1 FROM public.group_admin_invites AS gi WHERE gi.id='64000000-0000-4000-8000-000000000003' AND gi.admin_id='63000000-0000-4000-8000-000000000003' AND gi.claimed_at IS NOT NULL AND gi.claimed_by='61000000-0000-4000-8000-000000000002')
 OR NOT EXISTS (SELECT 1 FROM public.group_members AS gm WHERE gm.group_id='62000000-0000-4000-8000-000000000003' AND gm.user_id='61000000-0000-4000-8000-000000000002' AND gm.status='active')
 THEN RAISE EXCEPTION 'Case C final state differs'; END IF;
END $$;
COMMIT;
\echo 'Case C read-only final state assertions completed.'
\elif :cleanup
\echo 'STOP: cleanup is unimplemented; separate scope review and explicit approval required.'
\quit 1
\else
\echo 'STOP: choose exactly one setup, case session, or case verification mode.'
\quit 1
\endif
