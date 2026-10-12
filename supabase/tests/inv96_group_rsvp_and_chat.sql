-- Run only in an isolated database with the supplied production chat triggers installed.
BEGIN;

INSERT INTO public.groups (id, slug, name)
VALUES ('a1000000-0000-4000-8000-000000000001', 'inv96-compat-test', 'INV96 isolated compatibility');
INSERT INTO public.group_members (group_id, user_id, status)
VALUES ('a1000000-0000-4000-8000-000000000001', '342e1acf-25d3-4500-8192-5a9904aa98f5', 'active');
INSERT INTO public.events (id, user_id, title, event_date, visibility)
VALUES ('a1000000-0000-4000-8000-000000000002', 'f4a6ac62-c795-42aa-b5cc-a7105124dba8',
  'INV96 isolated restricted event', now() + interval '7 days', 'group');
INSERT INTO public.event_groups (event_id, group_id)
VALUES ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"342e1acf-25d3-4500-8192-5a9904aa98f5"}', true);
SELECT set_config('request.jwt.claim.sub', '342e1acf-25d3-4500-8192-5a9904aa98f5', true);
INSERT INTO public.event_rsvps (event_id, user_id, name, email, role_type, status)
VALUES ('a1000000-0000-4000-8000-000000000002', auth.uid(), 'Test member', 'member@example.test', 'actor', 'going');
SELECT 'PASS: permitted group member can RSVP' AS result;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"93b30091-5b38-44b6-bd76-4cd45550f389"}', true);
SELECT set_config('request.jwt.claim.sub', '93b30091-5b38-44b6-bd76-4cd45550f389', true);
DO $$
DECLARE attended_value boolean;
BEGIN
  FOREACH attended_value IN ARRAY ARRAY[false, true] LOOP
    BEGIN
      INSERT INTO public.event_rsvps (event_id, user_id, name, email, role_type, status, attended)
      VALUES ('a1000000-0000-4000-8000-000000000002', auth.uid(), 'Test outsider', 'outsider@example.test', 'actor', 'going', attended_value);
      RAISE EXCEPTION 'FAIL: nonmember RSVP accepted with attended=%', attended_value;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: nonmember denied with attended=%', attended_value;
    END;
  END LOOP;
END $$;

INSERT INTO public.projects (id, creator_id, title, is_public, visibility)
VALUES ('a1000000-0000-4000-8000-000000000003', auth.uid(), 'INV96 isolated chat project', true, 'public');
INSERT INTO public.project_members (project_id, user_id, role)
VALUES ('a1000000-0000-4000-8000-000000000003', '342e1acf-25d3-4500-8192-5a9904aa98f5', 'Member');
RESET ROLE;
DO $$
DECLARE chat_uuid uuid;
BEGIN
  SELECT id INTO STRICT chat_uuid FROM public.project_group_chats
  WHERE project_id = 'a1000000-0000-4000-8000-000000000003';
  IF (SELECT count(*) FROM public.group_chat_members WHERE group_chat_id = chat_uuid
    AND user_id IN ('93b30091-5b38-44b6-bd76-4cd45550f389', '342e1acf-25d3-4500-8192-5a9904aa98f5')) <> 2
  THEN RAISE EXCEPTION 'FAIL: chat owner/member sync'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '342e1acf-25d3-4500-8192-5a9904aa98f5'
      AND type = 'group_chat_added' AND data->>'group_chat_id' = chat_uuid::text)
  THEN RAISE EXCEPTION 'FAIL: chat notification missing'; END IF;
  RAISE NOTICE 'PASS: project creation, member addition, chat sync and notification';
END $$;
ROLLBACK;
