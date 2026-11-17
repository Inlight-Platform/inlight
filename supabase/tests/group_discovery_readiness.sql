-- Isolated fixtures; execute manually against the approved local database only.
BEGIN;
-- Assert both effective role privileges and the actual/default PUBLIC ACL.
DO $$
DECLARE
  item record;
  function_oid regprocedure;
  role_name text;
  should_execute boolean;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public.group_has_confirmed_active_admin(uuid)', false, false, false),
    ('public.group_is_discoverable(uuid)', true, true, true),
    ('public.group_visible_to_caller(uuid)', true, true, true),
    ('public.get_discoverable_groups()', true, true, true),
    ('public.request_group_membership(uuid)', false, true, false),
    ('public.update_group_directory_listing(uuid,boolean)', false, true, false)
  ) AS expected(signature, allow_anon, allow_authenticated, allow_service_role) LOOP
    function_oid := item.signature::regprocedure;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p,
        LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
      WHERE p.oid = function_oid AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'PUBLIC can execute %', function_oid;
    END IF;
    FOR role_name, should_execute IN SELECT * FROM (VALUES
      ('anon', item.allow_anon),
      ('authenticated', item.allow_authenticated),
      ('service_role', item.allow_service_role)
    ) AS roles(name, allowed) LOOP
      IF has_function_privilege(role_name, function_oid, 'EXECUTE') IS DISTINCT FROM should_execute THEN
        RAISE EXCEPTION 'Unexpected EXECUTE on % for %; expected %', function_oid, role_name, should_execute;
      END IF;
    END LOOP;
  END LOOP;
END $$;
INSERT INTO auth.users (id,email,email_confirmed_at,created_at) VALUES
 ('61000000-0000-4000-8000-000000000001','readiness-admin@example.edu',now(),now()),
 ('61000000-0000-4000-8000-000000000002','readiness-pending@example.edu',null,now()),
 ('61000000-0000-4000-8000-000000000003','readiness-member@example.edu',now(),now()),
 ('61000000-0000-4000-8000-000000000004','readiness-visitor@example.edu',now(),now()),
 ('61000000-0000-4000-8000-000000000005','readiness-platform@example.edu',now(),now());
INSERT INTO public.user_roles (user_id, role)
VALUES ('61000000-0000-4000-8000-000000000005','admin');
INSERT INTO public.groups (id,slug,name,is_listed,faculty_owner_id) VALUES
 ('62000000-0000-4000-8000-000000000001','readiness-empty','Readiness empty',true,null),
 ('62000000-0000-4000-8000-000000000002','readiness-pending','Readiness pending',true,null),
 ('62000000-0000-4000-8000-000000000003','readiness-ready','Readiness ready',true,null),
 ('62000000-0000-4000-8000-000000000004','readiness-owner','Readiness owner',true,'61000000-0000-4000-8000-000000000001'),
 ('62000000-0000-4000-8000-000000000005','readiness-unlisted','Readiness unlisted',false,null),
 ('62000000-0000-4000-8000-000000000006','readiness-email','Readiness email',true,null),
 ('62000000-0000-4000-8000-000000000007','readiness-mismatch','Readiness mismatch',true,null);
INSERT INTO public.group_admins (group_id,user_id,email,status) VALUES
 ('62000000-0000-4000-8000-000000000002',null,'readiness-pending@example.edu','pending'),
 ('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000001','readiness-admin@example.edu','active'),
 ('62000000-0000-4000-8000-000000000005','61000000-0000-4000-8000-000000000001','readiness-admin@example.edu','active'),
 ('62000000-0000-4000-8000-000000000006',null,'readiness-admin@example.edu','active'),
 ('62000000-0000-4000-8000-000000000007','61000000-0000-4000-8000-000000000002','readiness-admin@example.edu','active');
INSERT INTO public.group_admin_invites (admin_id,token)
SELECT id, 'readiness-pending-fixture-token'
FROM public.group_admins
WHERE group_id='62000000-0000-4000-8000-000000000002'
  AND email='readiness-pending@example.edu'
  AND status='pending';
INSERT INTO public.group_members(group_id,user_id,status) VALUES
 ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003','active'),
 ('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000004','pending');
DO $$ BEGIN
 IF public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000001') OR public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000002') OR public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000004') THEN RAISE EXCEPTION 'Unready group marked ready'; END IF;
 IF NOT public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000003') OR NOT public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000006') THEN RAISE EXCEPTION 'Confirmed assignment not ready'; END IF;
 IF public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'Linked identity was incorrectly resolved by email'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ DECLARE rejected boolean := false; BEGIN
 IF EXISTS (SELECT 1 FROM public.groups WHERE slug='readiness-empty') THEN RAISE EXCEPTION 'Anonymous visitor saw unavailable group'; END IF;
 IF public.group_visible_to_caller('62000000-0000-4000-8000-000000000005') OR public.group_is_discoverable('62000000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'Anonymous unlisted probe leaked readiness'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.get_discoverable_groups() WHERE slug='readiness-ready') THEN RAISE EXCEPTION 'Anonymous listed ready group missing'; END IF;
 BEGIN PERFORM public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000005'); EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Anonymous can execute raw readiness'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000003"}',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE rejected boolean := false; BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='readiness-empty') THEN RAISE EXCEPTION 'Existing member lost group access'; END IF;
 BEGIN PERFORM public.request_group_membership('62000000-0000-4000-8000-000000000001'); EXCEPTION WHEN OTHERS THEN rejected := SQLERRM = 'You are already an active member'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Active member handling changed'; END IF;
 rejected := false;
 IF EXISTS (SELECT 1 FROM public.get_discoverable_groups() WHERE slug IN ('readiness-empty','readiness-pending','readiness-owner','readiness-unlisted')) THEN RAISE EXCEPTION 'Unavailable group discovered'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.get_discoverable_groups() WHERE slug='readiness-ready') THEN RAISE EXCEPTION 'Ready listed group missing'; END IF;
 BEGIN PERFORM public.request_group_membership('62000000-0000-4000-8000-000000000004'); EXCEPTION WHEN OTHERS THEN rejected := SQLERRM = 'This department is not accepting join requests' AND SQLSTATE = 'P0001'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unavailable request accepted'; END IF;
 rejected := false;
 BEGIN INSERT INTO public.group_members(group_id,user_id,status) VALUES ('62000000-0000-4000-8000-000000000004',auth.uid(),'pending'); EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Direct pending insert bypassed gate'; END IF;
 rejected := false;
 BEGIN PERFORM public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000005'); EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Authenticated caller can execute raw readiness'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000004"}',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000004',true);
DO $$
DECLARE
  target uuid;
  actual_message text;
  actual_state text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    '62000000-0000-4000-8000-000000000099'::uuid, -- nonexistent
    '62000000-0000-4000-8000-000000000005'::uuid, -- unlisted and ready
    '62000000-0000-4000-8000-000000000001'::uuid  -- listed and unready
  ] LOOP
    actual_message := null;
    actual_state := null;
    BEGIN
      PERFORM public.request_group_membership(target);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS actual_message = MESSAGE_TEXT, actual_state = RETURNED_SQLSTATE;
    END;
    IF actual_message IS DISTINCT FROM 'This department is not accepting join requests'
       OR actual_state IS DISTINCT FROM 'P0001' THEN
      RAISE EXCEPTION 'Refusal mismatch for %: message %, SQLSTATE %', target, actual_message, actual_state;
    END IF;
  END LOOP;
 IF public.group_visible_to_caller('62000000-0000-4000-8000-000000000005') OR public.group_is_discoverable('62000000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'Outsider unlisted probe leaked readiness'; END IF;
 IF public.request_group_membership('62000000-0000-4000-8000-000000000002') IS NULL THEN RAISE EXCEPTION 'Pending request not preserved'; END IF;
 IF public.request_group_membership('62000000-0000-4000-8000-000000000003') IS NULL THEN RAISE EXCEPTION 'Ready group request failed'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001"}',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE rejected boolean := false; BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='readiness-unlisted') THEN RAISE EXCEPTION 'Scoped admin lost access'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='readiness-owner') THEN RAISE EXCEPTION 'Legacy owner lost access'; END IF;
 BEGIN PERFORM public.request_group_membership('62000000-0000-4000-8000-000000000004'); EXCEPTION WHEN OTHERS THEN rejected := SQLERRM = 'This department is not accepting join requests' AND SQLSTATE = 'P0001'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Owner access bypassed request readiness'; END IF;
 rejected := false;
 BEGIN INSERT INTO public.group_members(group_id,user_id,status) VALUES ('62000000-0000-4000-8000-000000000004',auth.uid(),'pending'); EXCEPTION WHEN insufficient_privilege THEN rejected := true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Owner access bypassed direct-insert readiness'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000005"}',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.groups WHERE slug='readiness-empty') THEN RAISE EXCEPTION 'Platform admin lost access'; END IF;
 IF EXISTS (SELECT 1 FROM public.get_discoverable_groups() WHERE slug IN ('readiness-empty','readiness-unlisted')) THEN RAISE EXCEPTION 'Platform directory bypassed readiness'; END IF;
END $$;
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='61000000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.group_admins
   WHERE group_id='62000000-0000-4000-8000-000000000002'
     AND email='readiness-pending@example.edu' AND status='pending'
 ) OR public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'Confirmation alone activated the pending admin'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000002","email":"readiness-pending@example.edu"}',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result := public.claim_invites_on_signup(_platform_token := 'readiness-pending-fixture-token');
 IF result->>'group_admin_invite_status' IS DISTINCT FROM 'claimed'
 THEN RAISE EXCEPTION 'Pending admin token claim failed: %', result; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000005"}',true);
SELECT set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN
 IF NOT public.group_has_confirmed_active_admin('62000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Confirmation did not enable readiness'; END IF;
 IF (SELECT is_listed FROM public.groups WHERE slug='readiness-unlisted') THEN RAISE EXCEPTION 'Listing preference changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.get_discoverable_groups() WHERE slug='readiness-pending') THEN RAISE EXCEPTION 'Confirmed group not discoverable'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ DECLARE rejected boolean := false; BEGIN
 BEGIN PERFORM public.request_group_membership('62000000-0000-4000-8000-000000000003'); EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%Authentication required%'; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unauthenticated request accepted'; END IF;
END $$;
ROLLBACK;
