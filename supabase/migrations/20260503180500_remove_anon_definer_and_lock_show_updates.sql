-- Remove unnecessary anonymous execution on SECURITY DEFINER helpers and
-- prevent non-admin users from escalating nyc_shows categories via UPDATE.

-- 1) Users may edit only their own submitted shows, and only within the
-- same allowed non-admin categories.
DROP POLICY IF EXISTS "Users can update their own shows" ON public.nyc_shows;

CREATE POLICY "Users can update their own shows"
ON public.nyc_shows
FOR UPDATE
USING (auth.uid() = submitted_by)
WITH CHECK (
  auth.uid() = submitted_by
  AND category IN ('off-off-broadway', 'school')
);

-- 2) SECURITY DEFINER helpers no longer need anonymous execution.
REVOKE EXECUTE ON FUNCTION public.can_access_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_post(public.posts) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) FROM anon;
