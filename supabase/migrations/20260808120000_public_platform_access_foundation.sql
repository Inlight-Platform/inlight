-- Issue #112: Public platform access foundation.
-- Visitors may browse designated public resources, but account-only actions
-- remain protected by authenticated table grants and RLS checks.

-- Public browse surfaces.
GRANT SELECT ON public.events TO anon, authenticated;
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT SELECT ON public.project_roles TO anon, authenticated;
GRANT SELECT ON public.opportunities TO anon, authenticated;
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
GRANT SELECT ON public.companies TO anon, authenticated;
GRANT SELECT ON public.company_photos TO anon, authenticated;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Opportunities are viewable by everyone" ON public.opportunities;
DROP POLICY IF EXISTS "Public opportunities are viewable by visitors" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can view opportunities" ON public.opportunities;

CREATE POLICY "Public opportunities are viewable by visitors"
ON public.opportunities
FOR SELECT
TO anon
USING (COALESCE(is_public, false));

CREATE POLICY "Authenticated users can view opportunities"
ON public.opportunities
FOR SELECT
TO authenticated
USING (true);

-- RLS helper RPCs used by public read policies and public event attendee views.
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(public.posts) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view company-linked projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone can view public company-linked projects" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by visitors" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Project members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;

CREATE POLICY "Public projects are viewable by visitors"
ON public.projects
FOR SELECT
TO anon
USING (COALESCE(is_public, false));

CREATE POLICY "Authenticated users can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Project members can view their projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT project_members.user_id
    FROM public.project_members
    WHERE project_members.project_id = projects.id
  )
);

CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can view members of company-linked projects" ON public.project_members;
CREATE POLICY "Anyone can view members of public company-linked projects"
ON public.project_members
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.company_id IS NOT NULL
      AND COALESCE(p.is_public, false)
  )
);

DROP POLICY IF EXISTS "Anyone can view roles of company-linked projects" ON public.project_roles;
CREATE POLICY "Anyone can view roles of public company-linked projects"
ON public.project_roles
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_roles.project_id
      AND p.company_id IS NOT NULL
      AND COALESCE(p.is_public, false)
  )
);

-- Protected action surfaces. Visitors can read public listings, but applying,
-- internal RSVP, and private-user tables require a signed-in account.
REVOKE INSERT, UPDATE, DELETE ON public.event_rsvps FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;

DROP POLICY IF EXISTS "Anyone can RSVP" ON public.event_rsvps;
CREATE POLICY "Authenticated users can RSVP"
ON public.event_rsvps
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND event_id IS NOT NULL
  AND NULLIF(BTRIM(name), '') IS NOT NULL
  AND NULLIF(BTRIM(email), '') IS NOT NULL
  AND NULLIF(BTRIM(role_type), '') IS NOT NULL
  AND status IN ('going', 'cant_make_it')
  AND (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_rsvps.event_id
        AND e.event_date >= NOW()
    )
    OR attended IS TRUE
  )
);

REVOKE ALL ON public.opportunity_applications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_applications TO authenticated;

REVOKE ALL ON public.role_applications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_applications TO authenticated;

REVOKE ALL ON public.saved_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;

NOTIFY pgrst, 'reload schema';
