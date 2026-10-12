BEGIN;

DROP FUNCTION IF EXISTS public.can_browse_project(uuid);
CREATE FUNCTION public.can_browse_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE projects.id = _project_id
      AND (
        coalesce(projects.is_public, false)
        OR CASE
          WHEN auth.uid() IS NULL THEN false
          ELSE (
            projects.creator_id = auth.uid()
            OR EXISTS (
              SELECT 1
              FROM public.project_members
              WHERE project_members.project_id = projects.id
                AND project_members.user_id = auth.uid()
            )
            OR private.is_invited_to_project(projects.id)
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
        END
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_browse_project(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_browse_project(uuid) TO anon, authenticated;

CREATE OR REPLACE VIEW public.projects_browse
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
WHERE public.can_browse_project(projects.id);

REVOKE ALL ON public.projects_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

-- Restore the projects_browse definition from
-- 20261005164500_inv96_group5_guard_anonymous_browse_helpers.sql.
DROP FUNCTION IF EXISTS public.can_browse_project(uuid);

COMMIT;
*/
