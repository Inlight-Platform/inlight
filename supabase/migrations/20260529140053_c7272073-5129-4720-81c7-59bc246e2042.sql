
-- 1) PROFILES: prevent self-upgrade of plan_type and stripe_customer_id
REVOKE UPDATE (plan_type, stripe_customer_id) ON public.profiles FROM anon, authenticated;

-- 2) PROFILES: stop exposing email and stripe_customer_id to other authenticated users
REVOKE SELECT (email, stripe_customer_id) ON public.profiles FROM anon, authenticated;

-- 3) PROFILES_PUBLIC view: ensure it runs with the querier's privileges
ALTER VIEW public.profiles_public SET (security_invoker = on);

-- 4) EVENT_RSVPS: stop publicly exposing email column.
DROP POLICY IF EXISTS "RSVPs are publicly viewable" ON public.event_rsvps;

CREATE POLICY "Users can view their own RSVPs"
ON public.event_rsvps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Event creators can view RSVPs for their events"
ON public.event_rsvps FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM public.events WHERE id = event_rsvps.event_id)
);

CREATE POLICY "Admins can view all RSVPs"
ON public.event_rsvps FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) NOTIFICATIONS: remove client-side INSERT (only DB triggers / service role create notifications)
DROP POLICY IF EXISTS "Users can receive notifications" ON public.notifications;

-- 6) NYC_SHOWS: restrict category on user-driven UPDATEs
DROP POLICY IF EXISTS "Users can update their own shows" ON public.nyc_shows;
CREATE POLICY "Users can update their own shows"
ON public.nyc_shows FOR UPDATE
USING (auth.uid() = submitted_by)
WITH CHECK (
  auth.uid() = submitted_by
  AND category = ANY (ARRAY['off-off-broadway'::text, 'school'::text])
);

-- 7) PROFILE_VIEWS: replace spoofable current_setting with auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile views" ON public.profile_views;
CREATE POLICY "Users can view their own profile views"
ON public.profile_views FOR SELECT
USING (viewed_profile_id = auth.uid()::text);

-- 8) PROJECTS: do not expose private projects
DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects;

CREATE POLICY "Public projects are viewable by everyone"
ON public.projects FOR SELECT
USING (is_public = true);

CREATE POLICY "Creators can view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Project members can view their projects"
ON public.projects FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.project_members WHERE project_id = projects.id
  )
);

CREATE POLICY "Admins can view all projects"
ON public.projects FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));
