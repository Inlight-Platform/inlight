-- Run only against the separately confirmed local database. This file has three
-- mutually exclusive psql modes. The setup mode commits NEW synthetic fixtures
-- so two sessions can see them; it does not clean them up. Obtain separate
-- approval before deleting or closing anything. Never point at real groups.
--
-- Terminal 1: psql ... -v setup=1 -f this_file
-- Terminal 1: psql ... -v session_a=1 -f this_file
-- When A says it holds the lock: psql ... -v session_b=1 -f this_file
-- A commits only after pg_blocking_pids proves B is blocked by A. Both sessions
-- have timeouts; B must then observe the last-admin rejection and roll back.
\if :{?setup}
BEGIN;
INSERT INTO auth.users (id,email,email_confirmed_at,created_at) VALUES
 ('51000000-0000-4000-8000-000000000001','guard-race-a@example.edu',now(),now()),
 ('51000000-0000-4000-8000-000000000002','guard-race-b@example.edu',now(),now());
INSERT INTO public.groups (id,slug,name) VALUES
 ('52000000-0000-4000-8000-000000000001','guard-race-fixture','Guard race fixture');
INSERT INTO public.group_admins (id,group_id,user_id,email,status) VALUES
 ('53000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','guard-race-a@example.edu','active'),
 ('53000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','guard-race-b@example.edu','active');
COMMIT;
\elif :{?session_a}
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '25s';
SET LOCAL lock_timeout = '20s';
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"51000000-0000-4000-8000-000000000002"}',true);
SELECT set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.remove_group_admin('53000000-0000-4000-8000-000000000001');
DO $$
DECLARE deadline timestamptz := clock_timestamp() + interval '15 seconds';
BEGIN
  RAISE NOTICE 'A holds the group lock; start session B now';
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_locks marker
      WHERE marker.locktype = 'advisory' AND marker.classid = 742031::oid
        AND marker.objid = 742032::oid AND marker.objsubid = 2 AND marker.granted
        AND pg_backend_pid() = ANY(pg_blocking_pids(marker.pid))
    ) THEN
      RAISE NOTICE 'Observed session B blocked by session A';
      EXIT;
    END IF;
    IF clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'Session B did not block on session A within the deadline';
    END IF;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
COMMIT;
\elif :{?session_b}
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout = '25s';
SET LOCAL lock_timeout = '20s';
SET LOCAL application_name = 'guard-last-admin-session-b';
SELECT pg_advisory_xact_lock(742031, 742032);
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"51000000-0000-4000-8000-000000000002"}',true);
SELECT set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.remove_group_admin('53000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM LIKE '%Another confirmed active admin%';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Concurrent last-admin removal did not report the expected rejection'; END IF;
END $$;
SELECT 'Concurrent last-admin rejection observed' AS result;
ROLLBACK;
\else
\echo 'Choose exactly one: -v setup=1, -v session_a=1, or -v session_b=1'
\endif
