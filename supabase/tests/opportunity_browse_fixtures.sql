SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('f1000000-0000-4000-8000-000000000001', 'job-owner@example.test'),
 ('f1000000-0000-4000-8000-000000000002', 'job-other@example.test');
INSERT INTO public.opportunities
(id, title, description, posted_by, action_type, status, is_public, link_url, link_title,
 compensation, roles, requirements)
SELECT ('f2000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
 'Security job ' || i, 'Protected description ' || i,
 'f1000000-0000-4000-8000-000000000001'::uuid,
 action_type, status, is_public, link_url, 'Protected link', 'Protected pay',
 ARRAY['Protected role'], ARRAY['Protected requirement']
FROM (VALUES
 (1, 'apply', 'open', false, 'https://example.test/internal'),
 (2, 'apply', 'closed', false, NULL),
 (3, 'external', 'open', true, 'https://example.test/public'),
 (4, 'external', 'open', false, 'https://example.test/hidden'),
 (5, 'external', 'open', true, '   '),
 (6, 'external', 'open', true, NULL),
 (7, 'external', 'closed', true, 'https://example.test/closed')
) AS fixtures(i, action_type, status, is_public, link_url);
SET LOCAL session_replication_role = origin;
