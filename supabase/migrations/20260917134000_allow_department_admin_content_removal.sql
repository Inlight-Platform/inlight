-- Department admins may remove content only when it is linked to a department
-- they administer. Existing creator and platform-admin policies remain intact.
DROP POLICY IF EXISTS "Department admins can delete linked events"
ON public.events;

CREATE POLICY "Department admins can delete linked events"
ON public.events
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_groups eg
    WHERE eg.event_id = events.id
      AND public.is_group_faculty(auth.uid(), eg.group_id)
  )
);

DROP POLICY IF EXISTS "Department admins can delete linked projects"
ON public.projects;

CREATE POLICY "Department admins can delete linked projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_groups pg
    WHERE pg.project_id = projects.id
      AND public.is_group_faculty(auth.uid(), pg.group_id)
  )
);
