BEGIN;

CREATE OR REPLACE FUNCTION public.can_browse_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE projects.id = _project_id
      AND (
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
            OR private.is_invited_to_project(projects.id)
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
            OR (
              projects.visibility = 'specific'
              AND EXISTS (
                SELECT 1
                FROM public.project_recipients
                WHERE project_recipients.project_id = projects.id
                  AND project_recipients.recipient_id = auth.uid()
              )
            )
          )
        END
      )
  );
$$;

COMMIT;
