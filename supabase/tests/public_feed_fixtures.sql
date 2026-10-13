SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('e1000000-0000-4000-8000-000000000001', 'feed-owner@example.test'),
 ('e1000000-0000-4000-8000-000000000002', 'feed-other@example.test');
INSERT INTO public.profiles(user_id, email, display_name, hidden_from_public) VALUES
 ('e1000000-0000-4000-8000-000000000001', 'feed-owner@example.test', 'Feed author', false),
 ('e1000000-0000-4000-8000-000000000002', 'feed-other@example.test', 'Feed unrelated', false);
INSERT INTO public.posts(id, user_id, content, visibility)
SELECT ('e2000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
 'e1000000-0000-4000-8000-000000000001'::uuid, 'Feed post ' || i, visibility
FROM (VALUES (1, 'public'), (2, 'network'), (3, 'group'), (4, 'specific')) AS fixtures(i, visibility);
INSERT INTO public.events(id, user_id, slug, title, description, event_date, visibility)
SELECT ('e2000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
 'e1000000-0000-4000-8000-000000000001'::uuid, 'feed-security-event-' || i, 'Feed event ' || i,
 'Event description ' || i, '2099-01-01'::timestamptz, visibility
FROM (VALUES (1, 'public'), (2, 'network'), (3, 'group'), (4, 'specific'), (5, 'private'), (8, 'unlisted')) AS fixtures(i, visibility);
SET LOCAL session_replication_role = origin;
