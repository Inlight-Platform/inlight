-- Run manually only in the approved local database. All fixtures roll back.
BEGIN;
INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES
 ('31000000-0000-4000-8000-000000000001', 'multi-platform@example.edu', now(), now()),
 ('31000000-0000-4000-8000-000000000002', 'multi-confirmed@example.edu', now(), now()),
 ('31000000-0000-4000-8000-000000000003', 'multi-pending@example.edu', null, now()),
 ('31000000-0000-4000-8000-000000000004', 'multi-outsider@example.edu', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES ('31000000-0000-4000-8000-000000000001', 'admin');
INSERT INTO public.groups (id, slug, name) VALUES ('32000000-0000-4000-8000-000000000001', 'multi-other-fixture', 'Other department');

-- Deliberately fail one assignment to exercise per-address subtransactions.
CREATE FUNCTION pg_temp.fail_multi_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email = 'multi-fail@example.edu' THEN RAISE EXCEPTION 'fixture assignment failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER multi_fixture_failure BEFORE INSERT ON public.group_admins
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_multi_assignment();

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"31000000-0000-4000-8000-000000000001"}', true);
SELECT set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
DO $$
DECLARE
  created jsonb;
  created_group_id uuid;
  invitation jsonb;
  rejected boolean;
BEGIN
  created := public.admin_create_group_with_admins('Multi group', 'multi-group-fixture', null,
    ARRAY['multi-confirmed@example.edu', 'multi-pending@example.edu', 'MULTI-PENDING@example.edu', 'bad', 'multi-fail@example.edu']);
  created_group_id := (created->'group'->>'id')::uuid;
  IF NOT (created->'results' @> '[{"email":"multi-confirmed@example.edu","outcome":"assigned","status":"pending"}]'::jsonb)
     OR NOT (created->'results' @> '[{"email":"multi-pending@example.edu","outcome":"assigned","status":"pending"}]'::jsonb)
     OR NOT (created->'results' @> '[{"email":"multi-pending@example.edu","outcome":"duplicate"}]'::jsonb)
     OR NOT (created->'results' @> '[{"email":"bad","outcome":"invalid"}]'::jsonb)
     OR NOT (created->'results' @> '[{"email":"multi-fail@example.edu","outcome":"failed"}]'::jsonb) THEN
    RAISE EXCEPTION 'Per-address results mismatch: %', created;
  END IF;
  IF EXISTS (SELECT 1 FROM public.groups WHERE id = created_group_id AND faculty_owner_id IS NOT NULL) THEN RAISE EXCEPTION 'Unexpected compatibility owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = created_group_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Platform admin joined group'; END IF;
  invitation := public.create_group_admin_invite(created_group_id, 'multi-confirmed@example.edu', null);
  IF invitation->>'status' <> 'pending' OR NOT invitation ? 'token' THEN RAISE EXCEPTION 'Confirmed account must have a pending invitation'; END IF;
  invitation := public.create_group_admin_invite(created_group_id, 'multi-pending@example.edu', null);
  IF invitation->>'status' <> 'pending' OR (invitation->>'account_exists')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Pending existing account result mismatch'; END IF;
  PERFORM public.create_group_admin_invite(created_group_id, 'multi-pending@example.edu', null);
  IF (SELECT count(*) FROM public.group_admins WHERE group_admins.group_id = created_group_id AND email = 'multi-pending@example.edu') <> 1 THEN RAISE EXCEPTION 'Duplicate pending assignment'; END IF;
  invitation := public.create_group_admin_invite(created_group_id, 'multi-new@example.edu', null);
  IF invitation->>'status' <> 'pending' OR (invitation->>'account_exists')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'New account result mismatch'; END IF;
  rejected := false;
  BEGIN PERFORM public.admin_create_group_with_admins('Invalid', 'multi-invalid-fixture', null, ARRAY['bad']); EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Invalid-only creation succeeded'; END IF;
  rejected := false;
  BEGIN PERFORM public.admin_create_group_with_admins('Failure', 'multi-failed-fixture', null, ARRAY['multi-fail@example.edu']); EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected OR EXISTS (SELECT 1 FROM public.groups WHERE slug = 'multi-failed-fixture') THEN RAISE EXCEPTION 'All-failed creation did not roll back'; END IF;
  invitation := public.create_group_admin_invite(created_group_id, 'multi-confirmed@example.edu', null);
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"31000000-0000-4000-8000-000000000002"}', true);
  PERFORM set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
  IF (public.claim_invites_on_signup(_platform_token := invitation->>'token')->>'group_admin_invite_status') <> 'claimed' THEN RAISE EXCEPTION 'Invite claim failed'; END IF;
  IF NOT public.is_group_faculty(auth.uid(), created_group_id) OR NOT public.is_scoped_group_admin(auth.uid(), created_group_id) THEN RAISE EXCEPTION 'Active admin compatibility helpers failed'; END IF;
  PERFORM public.create_group_admin_invite(created_group_id, 'multi-department@example.edu', null);
  rejected := false;
  BEGIN PERFORM public.create_group_admin_invite('32000000-0000-4000-8000-000000000001', 'multi-denied@example.edu', null); EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Department admin managed another group'; END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"31000000-0000-4000-8000-000000000004"}', true);
  PERFORM set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000004', true);
  rejected := false;
  BEGIN PERFORM public.create_group_admin_invite(created_group_id, 'multi-denied@example.edu', null); EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unauthorized invitation succeeded'; END IF;
  rejected := false;
  BEGIN PERFORM public.admin_create_group_with_admins('Denied', 'multi-denied-fixture', null, ARRAY['a@example.edu']); EXCEPTION WHEN OTHERS THEN rejected := true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unauthorized creation succeeded'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id
    WHERE g.slug = 'multi-group-fixture' AND gm.user_id = '31000000-0000-4000-8000-000000000001'
  ) THEN RAISE EXCEPTION 'Platform admin was added as a group member'; END IF;
END $$;
ROLLBACK;
