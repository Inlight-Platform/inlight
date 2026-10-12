BEGIN;

-- INV96 Group 5: keep project discovery useful while preventing direct reads
-- of member-only and workflow-only project fields.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view company-linked projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view public company-linked projects" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by visitors" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Project creators can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Project members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Invited users can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;

CREATE POLICY "Authenticated users can view accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  coalesce(is_public, false)
  OR creator_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
  )
  OR public.is_invited_to_project(id)
  OR EXISTS (
    SELECT 1
    FROM public.project_groups
    WHERE project_groups.project_id = projects.id
      AND (
        public.is_group_member(auth.uid(), project_groups.group_id)
        OR public.is_group_faculty(auth.uid(), project_groups.group_id)
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Table reads are authenticated-only and limited to browse-safe columns.
-- Sensitive columns remain writable under existing write policies, but cannot
-- be selected directly by client roles.
REVOKE SELECT ON public.projects FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  category,
  created_at,
  creator_id,
  description,
  end_date,
  header_image_url,
  id,
  link_title,
  link_url,
  main_image_url,
  slug,
  start_date,
  status,
  title
) ON public.projects TO authenticated;

DROP VIEW IF EXISTS public.projects_browse;
CREATE VIEW public.projects_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  projects.category,
  projects.created_at,
  CASE WHEN auth.uid() IS NULL THEN NULL ELSE projects.creator_id END AS creator_id,
  projects.description,
  projects.end_date,
  projects.header_image_url,
  projects.id,
  projects.link_title,
  projects.link_url,
  projects.main_image_url,
  projects.slug,
  projects.start_date,
  projects.status,
  projects.title
FROM public.projects
WHERE
  coalesce(projects.is_public, false)
  OR projects.creator_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
  )
  OR public.is_invited_to_project(projects.id)
  OR EXISTS (
    SELECT 1
    FROM public.project_groups
    WHERE project_groups.project_id = projects.id
      AND (
        public.is_group_member(auth.uid(), project_groups.group_id)
        OR public.is_group_faculty(auth.uid(), project_groups.group_id)
      )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role);

REVOKE ALL ON public.projects_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_project_member_details(uuid);
CREATE FUNCTION public.get_project_member_details(_project_id uuid)
RETURNS TABLE (
  company_id uuid,
  google_drive_url text,
  is_public boolean,
  post_approval_required boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    projects.company_id,
    projects.google_drive_url,
    projects.is_public,
    projects.post_approval_required,
    projects.updated_at
  FROM public.projects
  WHERE projects.id = _project_id
    AND (
      projects.creator_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_project_member_details(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_member_details(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_company_projects_browse(uuid);
CREATE FUNCTION public.get_company_projects_browse(_company_id uuid)
RETURNS TABLE (
  category text,
  created_at timestamptz,
  description text,
  end_date date,
  header_image_url text,
  id uuid,
  link_title text,
  link_url text,
  main_image_url text,
  slug text,
  start_date date,
  status text,
  title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    projects.category,
    projects.created_at,
    projects.description,
    projects.end_date,
    projects.header_image_url,
    projects.id,
    projects.link_title,
    projects.link_url,
    projects.main_image_url,
    projects.slug,
    projects.start_date,
    projects.status,
    projects.title
  FROM public.projects
  WHERE projects.company_id = _company_id
    AND (
      coalesce(projects.is_public, false)
      OR projects.creator_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
      )
      OR public.is_invited_to_project(projects.id)
      OR EXISTS (
        SELECT 1
        FROM public.project_groups
        WHERE project_groups.project_id = projects.id
          AND (
            public.is_group_member(auth.uid(), project_groups.group_id)
            OR public.is_group_faculty(auth.uid(), project_groups.group_id)
          )
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  ORDER BY projects.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_company_projects_browse(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_projects_browse(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_company_project_browse(uuid, uuid);
CREATE FUNCTION public.get_company_project_browse(_company_id uuid, _project_id uuid)
RETURNS TABLE (
  category text,
  created_at timestamptz,
  description text,
  end_date date,
  header_image_url text,
  id uuid,
  link_title text,
  link_url text,
  main_image_url text,
  slug text,
  start_date date,
  status text,
  title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    projects.category,
    projects.created_at,
    projects.description,
    projects.end_date,
    projects.header_image_url,
    projects.id,
    projects.link_title,
    projects.link_url,
    projects.main_image_url,
    projects.slug,
    projects.start_date,
    projects.status,
    projects.title
  FROM public.projects
  WHERE projects.company_id = _company_id
    AND projects.id = _project_id
    AND (
      coalesce(projects.is_public, false)
      OR projects.creator_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_company_project_browse(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_project_browse(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP VIEW IF EXISTS public.projects_browse;
DROP FUNCTION IF EXISTS public.get_project_member_details(uuid);
DROP FUNCTION IF EXISTS public.get_company_projects_browse(uuid);
DROP FUNCTION IF EXISTS public.get_company_project_browse(uuid, uuid);

REVOKE SELECT ON public.projects FROM authenticated;
GRANT SELECT ON public.projects TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can view accessible projects" ON public.projects;
CREATE POLICY "Public projects are viewable by visitors"
ON public.projects FOR SELECT TO anon
USING (coalesce(is_public, false));
CREATE POLICY "Authenticated users can view projects"
ON public.projects FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Project members can view their projects"
ON public.projects FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT project_members.user_id
    FROM public.project_members
    WHERE project_members.project_id = projects.id
  )
);
CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMIT;
*/
