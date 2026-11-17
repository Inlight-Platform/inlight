-- Execute only against the intended local test database; fixture changes roll back.
BEGIN;
INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES
 ('41000000-0000-4000-8000-000000000001', 'token-platform@example.edu', now(), now()),
 ('41000000-0000-4000-8000-000000000002', 'token-recipient@example.edu', null, now()),
 ('41000000-0000-4000-8000-000000000003', 'token-other@example.edu', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES ('41000000-0000-4000-8000-000000000001', 'admin');
INSERT INTO public.groups (id, slug, name) VALUES
 ('42000000-0000-4000-8000-000000000001', 'token-group-a', 'Token group A'),
 ('42000000-0000-4000-8000-000000000002', 'token-group-b', 'Token group B'),
 ('42000000-0000-4000-8000-000000000003', 'token-conflict', 'Token conflict');
INSERT INTO public.group_members (group_id, user_id, status) VALUES
 ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003', 'active');
INSERT INTO public.group_admins (id, group_id, user_id, email, status) VALUES
 ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'token-platform@example.edu', 'active'),
 ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000002', 'old-address@example.edu', 'pending'),
 ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000003', null, 'token-recipient@example.edu', 'pending');
INSERT INTO public.group_admin_invites (admin_id, token) VALUES
 ('43000000-0000-4000-8000-000000000003', 'conflict-fixture-token');

-- The application has no direct UPDATE privilege; this helper exercises the
-- real trigger as its owner while all assertions themselves use authenticated.
CREATE FUNCTION pg_temp.try_admin_demotion(_admin_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.group_admins SET status = 'pending' WHERE id = _admin_id;
END $$;
CREATE TEMP TABLE token_fixture (name text PRIMARY KEY, value jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE ON token_fixture TO authenticated;

-- Verify the table itself is inaccessible even if the caller knows a token.
SET LOCAL ROLE anon;
DO $$ DECLARE n integer; BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.group_admin_invites;
    IF n <> 0 THEN RAISE EXCEPTION 'Anonymous user can read invite rows'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000001","email":"token-platform@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
INSERT INTO token_fixture VALUES
 ('a', public.create_group_admin_invite('42000000-0000-4000-8000-000000000001', 'token-recipient@example.edu', null)),
 ('b', public.create_group_admin_invite('42000000-0000-4000-8000-000000000002', 'token-recipient@example.edu', null));
INSERT INTO token_fixture SELECT 'platform', jsonb_build_object('token', token) FROM public.platform_invites
 WHERE email = 'token-recipient@example.edu' AND accepted_at IS NULL;
DO $$
DECLARE a jsonb; b jsonb; rejected boolean;
BEGIN
  SELECT value INTO STRICT a FROM token_fixture WHERE name = 'a';
  SELECT value INTO STRICT b FROM token_fixture WHERE name = 'b';
  IF a->>'token' IS NULL OR b->>'token' IS NULL OR a->>'token' = b->>'token' THEN
    RAISE EXCEPTION 'Assignments must have distinct tokens';
  END IF;
  IF (public.create_group_admin_invite('42000000-0000-4000-8000-000000000001', 'token-recipient@example.edu', null)->>'token') <> a->>'token' THEN
    RAISE EXCEPTION 'Delivery retry changed token';
  END IF;
  rejected := false;
  BEGIN PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%Another confirmed active admin%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Pending successor allowed last active removal'; END IF;
  rejected := false;
  BEGIN PERFORM pg_temp.try_admin_demotion('43000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%active admin identity or status cannot be reassigned%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Pending successor allowed direct demotion'; END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000002","email":"token-recipient@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE n integer; claim jsonb; BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.group_admin_invites;
    IF n <> 0 THEN RAISE EXCEPTION 'Recipient can read invite rows'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  claim := public.claim_invites_on_signup(_platform_token := (SELECT value->>'token' FROM token_fixture WHERE name = 'a'));
  IF claim->>'group_admin_invite_status' <> 'unconfirmed' THEN RAISE EXCEPTION 'Unconfirmed claim: %', claim; END IF;
END $$;

-- Confirmation is privileged fixture setup, not an assertion or claim.
RESET ROLE;
UPDATE auth.users SET email_confirmed_at = now() WHERE id = '41000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000001","email":"token-platform@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.group_admins WHERE id IN
    ((SELECT (value->>'admin_id')::uuid FROM token_fixture WHERE name='a'), (SELECT (value->>'admin_id')::uuid FROM token_fixture WHERE name='b')) AND status = 'active') THEN
    RAISE EXCEPTION 'Confirmation activated an assignment';
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000002","email":"token-recipient@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE claim jsonb; BEGIN
  claim := public.claim_invites_on_signup(_platform_token := (SELECT value->>'token' FROM token_fixture WHERE name='platform'));
  IF (claim->>'platform_invite_claimed')::boolean IS NOT TRUE OR (claim->>'group_admin_invites_claimed')::integer <> 0 THEN
    RAISE EXCEPTION 'Platform claim changed admin assignment: %', claim;
  END IF;
  claim := public.claim_invites_on_signup(_platform_token := 'wrong-token');
  IF claim->>'group_admin_invite_status' <> 'not_found' OR (claim->>'group_admin_invites_claimed')::integer <> 0 THEN
    RAISE EXCEPTION 'Wrong token accepted: %', claim;
  END IF;
  claim := public.claim_invites_on_signup(_platform_token := 'conflict-fixture-token');
  IF claim->>'group_admin_invite_status' <> 'assignment_conflict' OR (claim->>'group_admin_invites_claimed')::integer <> 0 THEN
    RAISE EXCEPTION 'Existing assignment conflict not reported: %', claim;
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000003","email":"token-other@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000003', true);
DO $$ DECLARE n integer; claim jsonb; BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.group_admin_invites;
    IF n <> 0 THEN RAISE EXCEPTION 'Unrelated member can read invite rows'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  claim := public.claim_invites_on_signup(_platform_token := (SELECT value->>'token' FROM token_fixture WHERE name='a'));
  IF claim->>'group_admin_invite_status' <> 'not_matching' OR (claim->>'group_admin_invites_claimed')::integer <> 0 THEN
    RAISE EXCEPTION 'Other account claimed invitation: %', claim;
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000001","email":"token-platform@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.group_admins WHERE id IN
    ((SELECT (value->>'admin_id')::uuid FROM token_fixture WHERE name='a'), (SELECT (value->>'admin_id')::uuid FROM token_fixture WHERE name='b'), '43000000-0000-4000-8000-000000000003') AND status='pending') <> 3 THEN
    RAISE EXCEPTION 'Failed or unrelated claim changed an assignment';
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000002","email":"token-recipient@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE claim jsonb; BEGIN
  claim := public.claim_invites_on_signup(_platform_token := (SELECT value->>'token' FROM token_fixture WHERE name='a'));
  IF claim->>'group_admin_invite_status' <> 'claimed' THEN RAISE EXCEPTION 'Token A claim failed: %', claim; END IF;
  claim := public.claim_invites_on_signup(_platform_token := (SELECT value->>'token' FROM token_fixture WHERE name='a'));
  IF claim->>'group_admin_invite_status' <> 'already_claimed' THEN RAISE EXCEPTION 'Token A replay failed: %', claim; END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000001","email":"token-platform@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
DO $$ DECLARE a jsonb; b jsonb; active_result jsonb; rejected boolean; BEGIN
  SELECT value INTO STRICT a FROM token_fixture WHERE name='a';
  SELECT value INTO STRICT b FROM token_fixture WHERE name='b';
  IF NOT EXISTS (SELECT 1 FROM public.group_admins WHERE id=(a->>'admin_id')::uuid AND status='active' AND user_id='41000000-0000-4000-8000-000000000002')
     OR NOT EXISTS (SELECT 1 FROM public.group_admins WHERE id=(b->>'admin_id')::uuid AND status='pending') THEN
    RAISE EXCEPTION 'Token A did not exclusively activate A';
  END IF;
  active_result := public.create_group_admin_invite('42000000-0000-4000-8000-000000000001', 'token-recipient@example.edu', null);
  IF active_result->>'outcome' <> 'already_active' OR active_result ? 'token' THEN RAISE EXCEPTION 'Already-active result incorrect'; END IF;
  rejected := false;
  BEGIN PERFORM pg_temp.try_admin_demotion('43000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%active admin identity or status cannot be reassigned%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Direct demotion allowed after claim'; END IF;
  PERFORM public.remove_group_admin('43000000-0000-4000-8000-000000000001');
  rejected := false;
  BEGIN PERFORM public.remove_group_admin((a->>'admin_id')::uuid);
  EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%Another confirmed active admin%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Last active removal allowed after claim'; END IF;
  rejected := false;
  BEGIN PERFORM pg_temp.try_admin_demotion((a->>'admin_id')::uuid);
  EXCEPTION WHEN OTHERS THEN rejected := SQLERRM LIKE '%active admin identity or status cannot be reassigned%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Last active direct demotion allowed after claim'; END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"41000000-0000-4000-8000-000000000002","email":"token-recipient@example.edu"}', true);
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
DO $$ DECLARE claim jsonb; BEGIN
  claim := public.claim_invites_on_signup(_platform_token := (SELECT value->>'token' FROM token_fixture WHERE name='b'));
  IF claim->>'group_admin_invite_status' <> 'claimed' THEN RAISE EXCEPTION 'Token B claim failed: %', claim; END IF;
END $$;
RESET ROLE;
ROLLBACK;
