BEGIN;

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
WHERE
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
  END;

REVOKE ALL ON public.projects_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

-- Restore the projects_browse definition from
-- 20261005163000_inv96_group5_project_browse_privacy.sql.

COMMIT;
*/
