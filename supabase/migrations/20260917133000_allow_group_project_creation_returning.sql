-- Project creation returns the inserted row before the client can add its
-- project_groups link. Allow only that short-lived, creator-owned state.
DROP POLICY IF EXISTS "Creators can view unlinked group project bootstrap"
ON public.projects;

CREATE POLICY "Creators can view unlinked group project bootstrap"
ON public.projects
FOR SELECT
TO authenticated
USING (
  visibility = 'group'
  AND creator_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_groups pg
    WHERE pg.project_id = projects.id
  )
);
