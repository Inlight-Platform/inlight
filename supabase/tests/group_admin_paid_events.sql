-- Execute only against the intended local test database.
-- Fixture changes are rolled back.
BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES
  ('81000000-0000-4000-8000-000000000001', 'paid-group-admin@example.edu', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'paid-plain-user@example.edu', now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'paid-platform-admin@example.edu', now(), now());

INSERT INTO public.user_roles (user_id, role)
VALUES ('81000000-0000-4000-8000-000000000003', 'admin');

INSERT INTO public.groups (id, slug, name)
VALUES ('82000000-0000-4000-8000-000000000001', 'paid-event-test-group', 'Paid event test group');

INSERT INTO public.group_admins (group_id, user_id, email, status)
VALUES (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  'paid-group-admin@example.edu',
  'active'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- An active group admin can create a paid event.
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001"}', true);
INSERT INTO public.events (user_id, slug, title, event_date, is_paid, price, currency)
VALUES (auth.uid(), 'group-admin-paid-event', 'Group admin paid event', now() + interval '1 day', true, 10, 'usd');

-- A plain user is rejected for the paid-event permission reason.
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000002"}', true);
DO $$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.events (user_id, slug, title, event_date, is_paid, price, currency)
    VALUES (auth.uid(), 'plain-user-paid-event', 'Plain user paid event', now() + interval '1 day', true, 10, 'usd');
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'Only Inlight admins can create paid events';
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION 'Plain user was not rejected by the paid-event permission check';
  END IF;
END;
$$;

-- A platform admin can still create a paid event.
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000003"}', true);
INSERT INTO public.events (user_id, slug, title, event_date, is_paid, price, currency)
VALUES (auth.uid(), 'platform-admin-paid-event', 'Platform admin paid event', now() + interval '1 day', true, 10, 'usd');

ROLLBACK;
