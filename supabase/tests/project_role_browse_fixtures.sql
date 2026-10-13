SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('d1000000-0000-4000-8000-000000000001', 'role-owner@example.test'),
 ('d1000000-0000-4000-8000-000000000002', 'role-other@example.test');
INSERT INTO public.projects(id, title, slug, creator_id, is_public, end_date, google_drive_url)
SELECT ('d2000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
 'Role project ' || i, 'role-security-project-' || i,
 'd1000000-0000-4000-8000-000000000001'::uuid, is_public, '2099-01-01'::date,
 'https://example.test/protected-drive'
FROM (VALUES (1, true), (2, false), (3, NULL::boolean), (4, true)) AS fixtures(i, is_public);
INSERT INTO public.project_roles(id, project_id, role_name, assigned_user_id)
SELECT ('d3000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
 ('d2000000-0000-4000-8000-' || lpad(project_number::text, 12, '0'))::uuid,
 'Security role ' || i,
 CASE WHEN assigned THEN 'd1000000-0000-4000-8000-000000000002'::uuid ELSE NULL END
FROM (VALUES (1, 1, false), (2, 1, true), (3, 2, false), (4, 3, false), (5, 4, false))
  AS fixtures(i, project_number, assigned);
SET LOCAL session_replication_role = origin;
