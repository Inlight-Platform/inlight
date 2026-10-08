BEGIN;

-- Signed-out visitors may discover internal Inlight jobs, but they must sign in
-- before viewing protected details or applying. Keep the base tables private and
-- expose only the fields needed to render public teaser cards.
CREATE OR REPLACE VIEW public.opportunities_public_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  o.id,
  o.title,
  CASE WHEN o.action_type = 'external' THEN o.description ELSE ''::text END AS description,
  o.type,
  o.status,
  NULL::uuid AS posted_by,
  o.company,
  o.location,
  o.is_remote,
  CASE WHEN o.action_type = 'external' THEN o.compensation ELSE NULL::text END AS compensation,
  o.experience_level,
  CASE WHEN o.action_type = 'external' THEN o.roles ELSE ARRAY[]::text[] END AS roles,
  CASE WHEN o.action_type = 'external' THEN o.requirements ELSE ARRAY[]::text[] END AS requirements,
  o.deadline,
  o.start_date,
  o.duration,
  o.tags,
  o.is_featured,
  o.action_type,
  o.image_url,
  CASE WHEN o.action_type = 'external' THEN o.link_url ELSE NULL::text END AS link_url,
  CASE WHEN o.action_type = 'external' THEN o.link_title ELSE NULL::text END AS link_title,
  o.is_public,
  o.created_at,
  o.updated_at
FROM public.opportunities o
WHERE
  (
    o.action_type = 'external'
    AND COALESCE(o.is_public, false)
    AND NULLIF(BTRIM(o.link_url), '') IS NOT NULL
  )
  OR (
    COALESCE(o.action_type, 'apply') <> 'external'
    AND o.status = 'open'
  );

REVOKE ALL ON public.opportunities_public_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opportunities_public_browse TO anon, authenticated;

CREATE OR REPLACE VIEW public.project_roles_public_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  r.id,
  r.role_name,
  r.project_id,
  p.title AS project_title,
  p.end_date AS project_deadline,
  r.created_at
FROM public.project_roles r
JOIN public.projects p ON p.id = r.project_id
WHERE
  r.assigned_user_id IS NULL
  AND COALESCE(p.is_public, false);

REVOKE ALL ON public.project_roles_public_browse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_roles_public_browse TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP VIEW IF EXISTS public.project_roles_public_browse;
DROP VIEW IF EXISTS public.opportunities_public_browse;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
