BEGIN;

-- Home excludes group-only projects and resolves department attribution after sign-in.
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
  projects.title,
  projects.visibility,
  CASE WHEN auth.uid() IS NULL THEN NULL ELSE projects.author_identity END AS author_identity,
  CASE WHEN auth.uid() IS NULL THEN NULL ELSE projects.author_group_id END AS author_group_id
FROM public.projects
WHERE public.can_browse_project(projects.id);

REVOKE ALL ON public.projects_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP VIEW public.projects_browse;

CREATE VIEW public.projects_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT projects.category, projects.created_at,
       CASE WHEN auth.uid() IS NULL THEN NULL ELSE projects.creator_id END AS creator_id,
       projects.description, projects.end_date, projects.header_image_url,
       projects.id, projects.link_title, projects.link_url, projects.main_image_url,
       projects.slug, projects.start_date, projects.status, projects.title
FROM public.projects
WHERE public.can_browse_project(projects.id);

REVOKE ALL ON public.projects_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects_browse TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;

*/
