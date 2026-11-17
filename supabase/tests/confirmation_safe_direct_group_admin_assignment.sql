-- Run only in an isolated local database after the complete integration is reviewed.
-- Direct assignment and helper assertions; lifecycle wiring is tested separately.
BEGIN;
INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES
 ('11000000-0000-4000-8000-000000000001', 'direct-platform@example.edu', now(), now()),
 ('11000000-0000-4000-8000-000000000002', 'direct-confirmed@example.edu', now(), now()),
 ('11000000-0000-4000-8000-000000000003', 'direct-unconfirmed@example.edu', null, now()),
 ('11000000-0000-4000-8000-000000000004', 'direct-old@example.edu', now(), now());
INSERT INTO public.user_roles (user_id, role)
VALUES ('11000000-0000-4000-8000-000000000001', 'admin');
INSERT INTO public.groups (id, slug, name)
VALUES ('12000000-0000-4000-8000-000000000001', 'direct-fixture', 'Direct fixture');
INSERT INTO public.group_admins (group_id, user_id, email, status, role) VALUES
 ('12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', 'direct-old@example.edu', 'pending', 'admin'),
 ('12000000-0000-4000-8000-000000000001', null, 'direct-confirmed@example.edu', 'pending', 'admin'),
 ('12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 'direct-unconfirmed@example.edu', 'active', 'admin');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"11000000-0000-4000-8000-000000000001"}', true);
SELECT set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  confirmed_group uuid;
  unconfirmed_group uuid;
  absent_group uuid;
  result public.group_admins%rowtype;
BEGIN
  confirmed_group := (public.admin_create_group('Direct confirmed', 'direct-confirmed', null, 'direct-confirmed@example.edu')->>'id')::uuid;
  unconfirmed_group := (public.admin_create_group('Direct unconfirmed', 'direct-unconfirmed', null, 'direct-unconfirmed@example.edu')->>'id')::uuid;
  absent_group := (public.admin_create_group('Direct absent', 'direct-absent', null, 'direct-absent@example.edu')->>'id')::uuid;

  IF EXISTS (SELECT 1 FROM public.groups WHERE id IN (confirmed_group, unconfirmed_group, absent_group) AND faculty_owner_id IS NOT NULL)
     OR (SELECT count(*) FROM public.group_admins WHERE group_id IN (confirmed_group, unconfirmed_group, absent_group) AND status = 'pending') <> 3 THEN
    RAISE EXCEPTION 'Creation must leave every assignment pending without ownership';
  END IF;

  result := public.add_group_admin_by_email(confirmed_group, 'direct-unconfirmed@example.edu');
  IF result.status <> 'pending' THEN RAISE EXCEPTION 'Unconfirmed insert activated'; END IF;
  result := public.add_group_admin_by_email(confirmed_group, 'direct-absent@example.edu');
  IF result.status <> 'pending' THEN RAISE EXCEPTION 'Absent insert activated'; END IF;
  result := public.add_group_admin_by_email(unconfirmed_group, 'direct-confirmed@example.edu');
  IF result.status <> 'pending' THEN
    RAISE EXCEPTION 'Confirmed insert was not pending';
  END IF;
  -- Existing pending email row remains pending when its account is unconfirmed.
  result := public.add_group_admin_by_email(confirmed_group, 'direct-unconfirmed@example.edu');
  IF result.status <> 'pending' THEN RAISE EXCEPTION 'Pending email update activated'; END IF;

  -- Existing pending rows remain pending even for confirmed users.
  result := public.add_group_admin_by_email('12000000-0000-4000-8000-000000000001', 'direct-old@example.edu');
  IF result.status <> 'pending' OR result.email <> 'direct-old@example.edu' THEN
    RAISE EXCEPTION 'Confirmed user-ID update failed';
  END IF;
  result := public.add_group_admin_by_email('12000000-0000-4000-8000-000000000001', 'direct-confirmed@example.edu');
  IF result.status <> 'pending' THEN
    RAISE EXCEPTION 'Confirmed email update did not remain pending';
  END IF;
  result := public.add_group_admin_by_email('12000000-0000-4000-8000-000000000001', 'direct-unconfirmed@example.edu');
  IF result.status <> 'active' OR result.user_id <> '11000000-0000-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'Existing active access was downgraded';
  END IF;

  -- Repeat addition to an existing active assignment changes nothing.
  result := public.add_group_admin_by_email('12000000-0000-4000-8000-000000000001', 'direct-unconfirmed@example.edu');
  IF result.status <> 'active' OR result.user_id <> '11000000-0000-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'Existing active assignment changed';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"11000000-0000-4000-8000-000000000002"}', true);
  PERFORM set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
  IF public.is_group_faculty(auth.uid(), confirmed_group)
     OR public.is_scoped_group_admin(auth.uid(), confirmed_group)
     OR public.is_group_faculty(auth.uid(), unconfirmed_group)
     OR public.is_scoped_group_admin(auth.uid(), unconfirmed_group) THEN
    RAISE EXCEPTION 'Pending assignments granted access';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"11000000-0000-4000-8000-000000000003"}', true);
  PERFORM set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);
  IF public.is_group_faculty(auth.uid(), unconfirmed_group)
     OR public.is_scoped_group_admin(auth.uid(), unconfirmed_group) THEN
    RAISE EXCEPTION 'Pending assignment granted helper access';
  END IF;
END $$;
ROLLBACK;
