CREATE FUNCTION pg_temp.assert_role_projection()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE mismatch boolean;
BEGIN
  WITH expected AS (
    SELECT r.id, r.role_name, r.project_id, p.title AS project_title, p.end_date AS project_deadline, r.created_at
    FROM public.project_roles r JOIN public.projects p ON p.id = r.project_id
    WHERE r.assigned_user_id IS NULL AND COALESCE(p.is_public, false)
  )
  SELECT EXISTS (SELECT to_jsonb(e) FROM expected e EXCEPT SELECT to_jsonb(c) FROM public.project_roles_public_catalog c)
    OR EXISTS (SELECT to_jsonb(c) FROM public.project_roles_public_catalog c EXCEPT SELECT to_jsonb(e) FROM expected e)
    INTO mismatch;
  IF mismatch THEN RAISE EXCEPTION 'Role mutation projection parity failed'; END IF;
END;
$$;
SELECT pg_temp.assert_role_projection();
UPDATE public.project_roles SET assigned_user_id = 'd1000000-0000-4000-8000-000000000002'
WHERE id = 'd3000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.project_roles_public_catalog WHERE id = 'd3000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Assigned role remained public';
  END IF;
END $$;
UPDATE public.project_roles SET assigned_user_id = NULL
WHERE id = 'd3000000-0000-4000-8000-000000000001';
UPDATE public.projects SET title = 'Updated public project', end_date = '2099-02-02'
WHERE id = 'd2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.project_roles_public_catalog
    WHERE id = 'd3000000-0000-4000-8000-000000000001' AND project_title = 'Updated public project'
      AND project_deadline = '2099-02-02'::date) THEN
    RAISE EXCEPTION 'Parent metadata did not synchronize';
  END IF;
END $$;
UPDATE public.projects SET is_public = false WHERE id = 'd2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.project_roles_public_catalog WHERE project_id = 'd2000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Private project role remained public';
  END IF;
END $$;
UPDATE public.projects SET is_public = true WHERE id = 'd2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
UPDATE public.projects SET is_public = NULL WHERE id = 'd2000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
UPDATE public.projects SET is_public = true WHERE id = 'd2000000-0000-4000-8000-000000000001';
UPDATE public.project_roles SET project_id = 'd2000000-0000-4000-8000-000000000002'
WHERE id = 'd3000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
UPDATE public.project_roles SET project_id = 'd2000000-0000-4000-8000-000000000004'
WHERE id = 'd3000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
ALTER TABLE public.project_roles ADD COLUMN security_test_private_note text DEFAULT 'Never public';
ALTER TABLE public.projects ADD COLUMN security_test_private_note text DEFAULT 'Never public';
UPDATE public.project_roles SET role_name = role_name WHERE id = 'd3000000-0000-4000-8000-000000000001';
UPDATE public.projects SET title = title WHERE id = 'd2000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_role_projection();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.project_roles_public_catalog c WHERE to_jsonb(c) ? 'security_test_private_note') THEN
    RAISE EXCEPTION 'Future private field leaked';
  END IF;
END $$;
UPDATE public.project_roles SET id = 'd3000000-0000-4000-8000-000000000088'
WHERE id = 'd3000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_role_projection();
DELETE FROM public.project_roles WHERE id = 'd3000000-0000-4000-8000-000000000088';
SELECT pg_temp.assert_role_projection();
DELETE FROM public.projects WHERE id = 'd2000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_role_projection();
TRUNCATE public.project_roles CASCADE;
SELECT pg_temp.assert_role_projection();
INSERT INTO public.project_roles(id, project_id, role_name)
VALUES ('d3000000-0000-4000-8000-000000000089', 'd2000000-0000-4000-8000-000000000001', 'New role');
SELECT pg_temp.assert_role_projection();
TRUNCATE public.projects CASCADE;
SELECT pg_temp.assert_role_projection();
