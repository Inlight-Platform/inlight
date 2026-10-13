CREATE FUNCTION pg_temp.assert_project_catalogs()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE mismatch boolean;
BEGIN
 WITH expected AS (SELECT category, created_at, description, end_date, header_image_url, id, link_title, link_url, main_image_url, slug, start_date, status, title, visibility FROM public.projects)
 SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.projects_browse_catalog c)
  OR EXISTS (SELECT to_jsonb(c) FROM public.projects_browse_catalog c EXCEPT SELECT to_jsonb(e) FROM expected e) INTO mismatch;
 IF mismatch THEN RAISE EXCEPTION 'Project metadata synchronization failed'; END IF;
 WITH expected AS (SELECT id,creator_id,author_identity,author_group_id FROM public.projects)
 SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.projects_browse_attribution c)
  OR EXISTS (SELECT to_jsonb(c) FROM public.projects_browse_attribution c EXCEPT SELECT to_jsonb(e) FROM expected e) INTO mismatch;
 IF mismatch THEN RAISE EXCEPTION 'Project attribution synchronization failed'; END IF;
 WITH expected AS (SELECT r.id,r.role_name,r.project_id,p.title AS project_title,p.end_date AS project_deadline,r.created_at
  FROM public.project_roles r JOIN public.projects p ON p.id=r.project_id
  WHERE r.assigned_user_id IS NULL AND COALESCE(p.is_public,false))
 SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.project_roles_public_catalog c)
  OR EXISTS (SELECT to_jsonb(c) FROM public.project_roles_public_catalog c EXCEPT SELECT to_jsonb(e) FROM expected e) INTO mismatch;
 IF mismatch THEN RAISE EXCEPTION 'Previously merged role projection regressed'; END IF;
END;
$$;
SELECT pg_temp.assert_project_catalogs();
DELETE FROM public.project_members WHERE project_id='c2000000-0000-4000-8000-000000000002';
UPDATE public.project_invitations SET status='declined' WHERE receiver_id='c1000000-0000-4000-8000-000000000003';
UPDATE public.group_members SET status='pending' WHERE user_id='c1000000-0000-4000-8000-000000000004';
UPDATE public.groups SET faculty_owner_id=NULL WHERE id='c4000000-0000-4000-8000-000000000001';
DELETE FROM public.group_admins WHERE user_id='c1000000-0000-4000-8000-000000000009';
DELETE FROM public.user_roles WHERE user_id='c1000000-0000-4000-8000-000000000006' AND role='admin';
SET LOCAL ROLE authenticated;
DO $$ DECLARE i integer; BEGIN
 FOREACH i IN ARRAY ARRAY[2,3,4,5,6,9] LOOP
  PERFORM set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-' || lpad(i::text,12,'0'),true);
  IF (SELECT count(*) FROM public.projects_browse WHERE id::text LIKE 'c2000000-%')<>1
   OR (SELECT count(*) FROM public.projects_browse_catalog WHERE id::text LIKE 'c2000000-%')<>1
   OR (SELECT count(*) FROM public.projects_browse_attribution WHERE id::text LIKE 'c2000000-%')<>1 THEN
   RAISE EXCEPTION 'Revoked audience remained accessible for viewer %',i;
  END IF;
 END LOOP;
END $$;
RESET ROLE;
INSERT INTO public.project_members(project_id,user_id)
VALUES ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002');
UPDATE public.project_invitations SET status='accepted' WHERE receiver_id='c1000000-0000-4000-8000-000000000003';
UPDATE public.group_members SET status='active' WHERE user_id='c1000000-0000-4000-8000-000000000004';
UPDATE public.groups SET faculty_owner_id='c1000000-0000-4000-8000-000000000005' WHERE id='c4000000-0000-4000-8000-000000000001';
INSERT INTO public.group_admins(group_id,user_id,status)
VALUES ('c4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000009','active');
INSERT INTO public.user_roles(user_id,role)
VALUES ('c1000000-0000-4000-8000-000000000006','admin');
SET LOCAL ROLE authenticated;
DO $$ DECLARE i integer; BEGIN
 FOREACH i IN ARRAY ARRAY[2,3,4,5,6,9] LOOP
  PERFORM set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-' || lpad(i::text,12,'0'),true);
  IF (SELECT count(*) FROM public.projects_browse WHERE id::text LIKE 'c2000000-%')<>(CASE WHEN i=6 THEN 4 ELSE 2 END) THEN
   RAISE EXCEPTION 'Restored audience access failed for viewer %',i;
  END IF;
 END LOOP;
END $$;
RESET ROLE;
UPDATE public.projects SET is_public=false WHERE id='c2000000-0000-4000-8000-000000000001';
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.projects_browse WHERE id='c2000000-0000-4000-8000-000000000001') THEN
  RAISE EXCEPTION 'Withdrawn project remained public';
 END IF;
END $$;
RESET ROLE;
UPDATE public.projects SET is_public=true,title='Republished project',end_date='2099-02-02'
WHERE id='c2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_project_catalogs();
ALTER TABLE public.projects ADD COLUMN security_test_secret text DEFAULT 'Never public';
UPDATE public.projects SET title=title WHERE id='c2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_project_catalogs();
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.projects_browse_catalog p WHERE to_jsonb(p) ? 'security_test_secret')
  OR EXISTS (SELECT 1 FROM public.projects_browse_attribution p WHERE to_jsonb(p) ? 'security_test_secret') THEN
  RAISE EXCEPTION 'Future private field leaked';
 END IF;
END $$;
UPDATE public.projects SET creator_id='c1000000-0000-4000-8000-000000000007'
WHERE id='c2000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_project_catalogs();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.projects_browse WHERE id='c2000000-0000-4000-8000-000000000004') THEN
  RAISE EXCEPTION 'Former owner retained private browse access';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000007',true);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.projects_browse WHERE id='c2000000-0000-4000-8000-000000000004'
  AND creator_id=auth.uid()) THEN RAISE EXCEPTION 'New owner attribution/access failed'; END IF;
END $$;
RESET ROLE;
UPDATE public.projects SET id='c2000000-0000-4000-8000-000000000088'
WHERE id='c2000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_project_catalogs();
DELETE FROM public.projects WHERE id='c2000000-0000-4000-8000-000000000088';
SELECT pg_temp.assert_project_catalogs();
INSERT INTO public.projects(id,title,creator_id,is_public)
VALUES ('c2000000-0000-4000-8000-000000000089','New browse project','c1000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.assert_project_catalogs();
TRUNCATE public.projects CASCADE;
SELECT pg_temp.assert_project_catalogs();
