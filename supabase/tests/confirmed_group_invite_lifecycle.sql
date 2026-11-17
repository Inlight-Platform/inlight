-- Run only against an approved isolated local database with the full package applied.
BEGIN;
INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES
 ('21000000-0000-4000-8000-000000000001', 'lifecycle-inviter@example.edu', now(), now());

INSERT INTO public.groups (id, slug, name, faculty_owner_id) VALUES
 ('22000000-0000-4000-8000-000000000001', 'lifecycle-pending', 'Lifecycle pending', '21000000-0000-4000-8000-000000000001'),
 ('22000000-0000-4000-8000-000000000002', 'lifecycle-confirmed', 'Lifecycle confirmed', '21000000-0000-4000-8000-000000000001');
INSERT INTO public.group_admins (group_id, user_id, email, status, role) VALUES
 ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'lifecycle-inviter@example.edu', 'active', 'admin'),
 ('22000000-0000-4000-8000-000000000001', null, 'lifecycle-pending@example.edu', 'pending', 'admin'),
 ('22000000-0000-4000-8000-000000000002', null, 'lifecycle-confirmed@example.edu', 'pending', 'admin');
INSERT INTO public.group_invites (group_id, email, membership_status_on_accept) VALUES
 ('22000000-0000-4000-8000-000000000001', 'lifecycle-pending@example.edu', 'active'),
 ('22000000-0000-4000-8000-000000000002', 'lifecycle-confirmed@example.edu', 'active');
INSERT INTO public.platform_invites (email, inviter_id) VALUES
 ('lifecycle-pending@example.edu', '21000000-0000-4000-8000-000000000001'),
 ('lifecycle-confirmed@example.edu', '21000000-0000-4000-8000-000000000001');

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at)
VALUES ('21000000-0000-4000-8000-000000000002', 'lifecycle-pending@example.edu', null, '{"display_name":"Signup profile"}', now());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '21000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Signup did not create a profile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.platform_invites WHERE email = 'lifecycle-pending@example.edu' AND accepted_by = '21000000-0000-4000-8000-000000000002' AND accepted_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.group_admins WHERE email = 'lifecycle-pending@example.edu' AND status = 'pending')
     OR NOT EXISTS (SELECT 1 FROM public.group_invites WHERE email = 'lifecycle-pending@example.edu' AND status = 'pending')
     OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = '22000000-0000-4000-8000-000000000001' AND user_id = '21000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Unconfirmed signup invitation handling failed';
  END IF;
END $$;

UPDATE public.profiles SET display_name = 'Preserved profile' WHERE user_id = '21000000-0000-4000-8000-000000000002';
UPDATE auth.users SET email_confirmed_at = now() WHERE id = '21000000-0000-4000-8000-000000000002';
UPDATE auth.users SET email_confirmed_at = email_confirmed_at WHERE id = '21000000-0000-4000-8000-000000000002';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '21000000-0000-4000-8000-000000000002' AND display_name = 'Preserved profile')
     OR NOT EXISTS (SELECT 1 FROM public.group_admins WHERE email = 'lifecycle-pending@example.edu' AND status = 'pending')
     OR NOT EXISTS (SELECT 1 FROM public.group_invites WHERE email = 'lifecycle-pending@example.edu' AND status = 'accepted' AND accepted_by = '21000000-0000-4000-8000-000000000002')
     OR (SELECT count(*) FROM public.group_members WHERE group_id = '22000000-0000-4000-8000-000000000001' AND user_id = '21000000-0000-4000-8000-000000000002' AND status = 'active') <> 1
     OR NOT EXISTS (SELECT 1 FROM public.groups WHERE id = '22000000-0000-4000-8000-000000000001' AND faculty_owner_id = '21000000-0000-4000-8000-000000000001')
     OR NOT EXISTS (SELECT 1 FROM public.group_admins WHERE group_id = '22000000-0000-4000-8000-000000000001' AND user_id = '21000000-0000-4000-8000-000000000001' AND status = 'active') THEN
    RAISE EXCEPTION 'Confirmation claims, profile, or existing access failed';
  END IF;
END $$;

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at)
VALUES ('21000000-0000-4000-8000-000000000003', 'lifecycle-confirmed@example.edu', now(), '{"display_name":"Confirmed profile"}', now());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '21000000-0000-4000-8000-000000000003')
     OR NOT EXISTS (SELECT 1 FROM public.platform_invites WHERE email = 'lifecycle-confirmed@example.edu' AND accepted_by = '21000000-0000-4000-8000-000000000003' AND accepted_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.group_admins WHERE email = 'lifecycle-confirmed@example.edu' AND status = 'pending')
     OR NOT EXISTS (SELECT 1 FROM public.group_invites WHERE email = 'lifecycle-confirmed@example.edu' AND status = 'accepted' AND accepted_by = '21000000-0000-4000-8000-000000000003')
     OR NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = '22000000-0000-4000-8000-000000000002' AND user_id = '21000000-0000-4000-8000-000000000003' AND status = 'active') THEN
    RAISE EXCEPTION 'Confirmed-at-insert invitation handling failed';
  END IF;
END $$;
ROLLBACK;
