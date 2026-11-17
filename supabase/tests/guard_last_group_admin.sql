-- Run manually on the approved local database; all fixtures and changes roll back.
BEGIN;
INSERT INTO auth.users (id,email,email_confirmed_at,created_at) VALUES
 ('41000000-0000-4000-8000-000000000001','guard-a@example.edu',now(),now()),
 ('41000000-0000-4000-8000-000000000002','guard-b@example.edu',now(),now()),
 ('41000000-0000-4000-8000-000000000003','guard-c@example.edu',now(),now()),
 ('41000000-0000-4000-8000-000000000004','guard-unconfirmed@example.edu',null,now()),
 ('41000000-0000-4000-8000-000000000005','guard-claim@example.edu',null,now()),
 ('41000000-0000-4000-8000-000000000006','guard-delete@example.edu',now(),now()),
 ('41000000-0000-4000-8000-000000000007','guard-replacement@example.edu',now(),now());
INSERT INTO public.groups (id,slug,name,faculty_owner_id) VALUES
 ('42000000-0000-4000-8000-000000000001','guard-demotion-fixture','Guard demotion','41000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000002','guard-other-fixture','Guard other',null),
 ('42000000-0000-4000-8000-000000000003','guard-pending-fixture','Guard pending','41000000-0000-4000-8000-000000000002'),
 ('42000000-0000-4000-8000-000000000004','guard-no-member-fixture','Guard no member',null),
 ('42000000-0000-4000-8000-000000000005','guard-direct-fixture','Guard direct','41000000-0000-4000-8000-000000000001'),
 ('42000000-0000-4000-8000-000000000006','guard-account-fixture','Guard account',null);
INSERT INTO public.group_admins (id,group_id,user_id,email,status) VALUES
 ('43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','guard-a@example.edu','active'),
 ('43000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','guard-b@example.edu','active'),
 ('43000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000001',null,'guard-invite@example.edu','pending'),
 ('43000000-0000-4000-8000-000000000004','42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003','guard-c@example.edu','active'),
 ('43000000-0000-4000-8000-000000000005','42000000-0000-4000-8000-000000000003',null,'guard-claim@example.edu','pending'),
 ('43000000-0000-4000-8000-000000000006','42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000004','guard-unconfirmed@example.edu','active'),
 ('43000000-0000-4000-8000-000000000007','42000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000001','guard-a@example.edu','active'),
 ('43000000-0000-4000-8000-000000000008','42000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000002','guard-b@example.edu','active'),
 ('43000000-0000-4000-8000-000000000009','42000000-0000-4000-8000-000000000005','41000000-0000-4000-8000-000000000001','guard-a@example.edu','active'),
 ('43000000-0000-4000-8000-000000000010','42000000-0000-4000-8000-000000000005','41000000-0000-4000-8000-000000000002','guard-b@example.edu','active'),
 ('43000000-0000-4000-8000-000000000011','42000000-0000-4000-8000-000000000006','41000000-0000-4000-8000-000000000006','guard-delete@example.edu','active'),
 ('43000000-0000-4000-8000-000000000012','42000000-0000-4000-8000-000000000006','41000000-0000-4000-8000-000000000007','guard-replacement@example.edu','active');
INSERT INTO public.group_admin_invites (admin_id,token)
VALUES ('43000000-0000-4000-8000-000000000005','guard-claim-fixture-token');
INSERT INTO public.group_members (group_id,user_id,status)
VALUES ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','pending')
ON CONFLICT (group_id,user_id) DO UPDATE SET status='pending';
DELETE FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000004' AND user_id='41000000-0000-4000-8000-000000000001';
DELETE FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000005' AND user_id='41000000-0000-4000-8000-000000000001';

SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000002"}',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE rejected boolean := false; members_before integer;
BEGIN
  PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000001');
  PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000007');
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000004' AND user_id='41000000-0000-4000-8000-000000000001' AND status='active') THEN RAISE EXCEPTION 'Absent membership was not created'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000001' AND user_id='41000000-0000-4000-8000-000000000001' AND status='active') THEN RAISE EXCEPTION 'Demoted admin is not an active member'; END IF;
  IF EXISTS (SELECT 1 FROM public.groups WHERE id='42000000-0000-4000-8000-000000000001' AND faculty_owner_id IS NOT NULL) THEN RAISE EXCEPTION 'Legacy owner remains'; END IF;
  BEGIN PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000002'); EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%Another confirmed active admin%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Last active removal was not rejected'; END IF;
  SELECT count(*) INTO members_before FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000001';
  PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000003');
  IF (SELECT count(*) FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000001') <> members_before THEN RAISE EXCEPTION 'Pending removal changed memberships'; END IF;
  rejected := false;
  BEGIN PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000004'); EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%Not authorized%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Cross-group removal was not rejected'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000001"}',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
  IF public.is_scoped_group_admin(auth.uid(),'42000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Demoted owner retained scoped powers'; END IF;
END $$;
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='41000000-0000-4000-8000-000000000005';
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000005","email":"guard-claim@example.edu"}',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb;
BEGIN
  result := public.claim_invites_on_signup(_platform_token := 'guard-claim-fixture-token');
  IF result->>'group_admin_invite_status' IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'Token claim failed: %', result;
  END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000001"}',true);
SELECT set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE rejected boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_admins WHERE id='43000000-0000-4000-8000-000000000005' AND status='active' AND user_id='41000000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'Pending confirmation claim did not link and activate'; END IF;
  DELETE FROM public.group_admins WHERE id='43000000-0000-4000-8000-000000000009';
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000005' AND user_id='41000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Direct deletion created membership'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id='42000000-0000-4000-8000-000000000005' AND faculty_owner_id='41000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Direct deletion changed ownership'; END IF;
  DELETE FROM auth.users WHERE id='41000000-0000-4000-8000-000000000006';
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id='42000000-0000-4000-8000-000000000006' AND user_id='41000000-0000-4000-8000-000000000006') THEN RAISE EXCEPTION 'Account deletion left or created membership'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id='42000000-0000-4000-8000-000000000003' AND faculty_owner_id='41000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Unrelated owner changed'; END IF;
  rejected := false;
  BEGIN UPDATE public.group_admins SET status='pending' WHERE id='43000000-0000-4000-8000-000000000002'; EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Last active deactivation succeeded'; END IF;
  rejected := false;
  BEGIN UPDATE public.group_admins SET group_id='42000000-0000-4000-8000-000000000003' WHERE id='43000000-0000-4000-8000-000000000002'; EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Active identity/group reassignment succeeded'; END IF;
  rejected := false;
  BEGIN UPDATE public.group_admins SET user_id='41000000-0000-4000-8000-000000000003' WHERE id='43000000-0000-4000-8000-000000000002'; EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Active user reassignment succeeded'; END IF;
  rejected := false;
  BEGIN DELETE FROM auth.users WHERE id='41000000-0000-4000-8000-000000000003'; EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%Another confirmed active admin%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Last admin account deletion was not rejected'; END IF;
  DELETE FROM public.groups WHERE id='42000000-0000-4000-8000-000000000002';
  IF EXISTS (SELECT 1 FROM public.groups WHERE id='42000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Group deletion was blocked'; END IF;
END $$;

-- A linked unconfirmed user must not become a successor via another user's email.
INSERT INTO public.groups (id,slug,name) VALUES
 ('42000000-0000-4000-8000-000000000007','guard-mismatch-fixture','Guard mismatch'),
 ('42000000-0000-4000-8000-000000000008','guard-email-fallback-fixture','Guard email fallback');
INSERT INTO public.group_admins (id,group_id,user_id,email,status) VALUES
 ('43000000-0000-4000-8000-000000000013','42000000-0000-4000-8000-000000000007','41000000-0000-4000-8000-000000000001','guard-a@example.edu','active'),
 ('43000000-0000-4000-8000-000000000014','42000000-0000-4000-8000-000000000007','41000000-0000-4000-8000-000000000004','guard-c@example.edu','active'),
 ('43000000-0000-4000-8000-000000000015','42000000-0000-4000-8000-000000000008','41000000-0000-4000-8000-000000000001','guard-a@example.edu','active'),
 ('43000000-0000-4000-8000-000000000016','42000000-0000-4000-8000-000000000008',null,'guard-b@example.edu','active');
DO $$ DECLARE rejected boolean := false; BEGIN
  BEGIN
    DELETE FROM public.group_admins WHERE id='43000000-0000-4000-8000-000000000013';
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM LIKE '%Another confirmed active admin%';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Mismatched email was counted as a linked successor'; END IF;
  DELETE FROM public.group_admins WHERE id='43000000-0000-4000-8000-000000000015';
  IF EXISTS (SELECT 1 FROM public.group_admins WHERE id='43000000-0000-4000-8000-000000000015') THEN
    RAISE EXCEPTION 'Confirmed unlinked email successor did not count';
  END IF;
END $$;
ROLLBACK;

-- A separate transaction covers a group-deletion cascade at higher isolation.
BEGIN ISOLATION LEVEL REPEATABLE READ;
INSERT INTO auth.users (id,email,email_confirmed_at,created_at)
VALUES ('44000000-0000-4000-8000-000000000001','guard-higher@example.edu',now(),now());
INSERT INTO public.groups (id,slug,name)
VALUES ('45000000-0000-4000-8000-000000000001','guard-higher-fixture','Guard higher isolation');
INSERT INTO public.group_admins (group_id,user_id,email,status)
VALUES ('45000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','guard-higher@example.edu','active');
DELETE FROM public.groups WHERE id='45000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.groups WHERE id='45000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Higher-isolation group deletion was blocked'; END IF;
END $$;
ROLLBACK;
