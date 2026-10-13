SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id,email)
SELECT ('c1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, 'project-browse-' || i || '@example.test'
FROM generate_series(1,9) i;
INSERT INTO public.user_roles(user_id,role)
VALUES ('c1000000-0000-4000-8000-000000000006','admin');
INSERT INTO public.groups(id,name,slug,faculty_owner_id)
VALUES ('c4000000-0000-4000-8000-000000000001','Browse department','browse-security-department',
 'c1000000-0000-4000-8000-000000000005');
INSERT INTO public.group_members(group_id,user_id,status) VALUES
 ('c4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004','active'),
 ('c4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000008','pending');
INSERT INTO public.group_admins(group_id,user_id,status)
VALUES ('c4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000009','active');
INSERT INTO public.projects(id,title,slug,creator_id,is_public,visibility,google_drive_url,
 author_identity,author_group_id)
SELECT ('c2000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
 'Browse project ' || i,'project-browse-security-' || i,'c1000000-0000-4000-8000-000000000001'::uuid,
 is_public,visibility,'https://example.test/member-drive',
 CASE WHEN i=3 THEN 'group' ELSE 'personal' END,
 CASE WHEN i=3 THEN 'c4000000-0000-4000-8000-000000000001'::uuid ELSE NULL END
FROM (VALUES (1,true,'public'),(2,false,'specific'),(3,false,'group'),(4,NULL::boolean,'network'))
 AS fixtures(i,is_public,visibility);
INSERT INTO public.project_members(project_id,user_id)
VALUES ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002');
INSERT INTO public.project_roles(id,project_id,role_name)
VALUES ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002','Invitee role'),
 ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','Public integration role');
INSERT INTO public.project_invitations(project_role_id,sender_id,receiver_id,status)
VALUES ('c3000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
 'c1000000-0000-4000-8000-000000000003','pending');
INSERT INTO public.project_groups(project_id,group_id)
VALUES ('c2000000-0000-4000-8000-000000000003','c4000000-0000-4000-8000-000000000001');
SET LOCAL session_replication_role = origin;
