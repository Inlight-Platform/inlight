-- PostgreSQL combines permissive SELECT policies with OR. Remove legacy
-- policies that let creators or all authenticated users bypass the current
-- group-membership checks in can_view_event() and can_access_project().

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Events are viewable based on visibility" ON public.events;

CREATE POLICY "Events are viewable based on visibility"
ON public.events
FOR SELECT
USING (public.can_view_event(events));

DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by everyone" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by visitors" ON public.projects;
DROP POLICY IF EXISTS "Creators can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Project members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;

CREATE POLICY "Public projects are viewable by visitors"
ON public.projects
FOR SELECT
TO anon
USING (visibility = 'public' OR COALESCE(is_public, false));

CREATE POLICY "Users can view accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (public.can_access_project(projects.id));

NOTIFY pgrst, 'reload schema';
