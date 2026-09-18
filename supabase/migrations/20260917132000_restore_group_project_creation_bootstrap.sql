-- Reinstall the group-project bootstrap after the project SELECT policies were
-- consolidated. The client creates the project before its project_groups row.
CREATE OR REPLACE FUNCTION public.can_access_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND CASE
        WHEN p.visibility = 'group' THEN
          EXISTS (
            SELECT 1
            FROM public.project_groups pg
            WHERE pg.project_id = p.id
              AND (
                public.is_group_member(auth.uid(), pg.group_id)
                OR public.is_group_faculty(auth.uid(), pg.group_id)
              )
          )
          OR (
            p.creator_id = auth.uid()
            AND NOT EXISTS (
              SELECT 1
              FROM public.project_groups pg
              WHERE pg.project_id = p.id
            )
          )
        ELSE
          p.visibility = 'public'
          OR COALESCE(p.is_public, false)
          OR p.creator_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1
            FROM public.project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = auth.uid()
          )
          OR public.is_invited_to_project(p.id)
          OR (
            p.visibility = 'network'
            AND EXISTS (
              SELECT 1
              FROM public.connections c1
              INNER JOIN public.connections c2
                ON c1.follower_id = c2.following_id
               AND c1.following_id = c2.follower_id
              WHERE c1.follower_id = p.creator_id
                AND c1.following_id = auth.uid()
            )
          )
          OR (
            p.visibility = 'specific'
            AND EXISTS (
              SELECT 1
              FROM public.project_recipients pr
              WHERE pr.project_id = p.id
                AND pr.recipient_id = auth.uid()
            )
          )
      END
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
CREATE POLICY "Authenticated users can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

NOTIFY pgrst, 'reload schema';
