-- Department admins can decide whether active members may publish into the
-- department. Admin posting access is independent of this setting.
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS members_can_post boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.can_post_to_group(_user uuid, _group uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_group_faculty(_user, _group)
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      JOIN public.group_members gm ON gm.group_id = g.id
      WHERE g.id = _group
        AND g.members_can_post
        AND gm.user_id = _user
        AND gm.status = 'active'
    )
$$;

REVOKE ALL ON FUNCTION public.can_post_to_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_post_to_group(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_group_member_posting(
  _group_id uuid,
  _members_can_post boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_faculty(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'Only department admins can update member posting';
  END IF;

  UPDATE public.groups
  SET members_can_post = _members_can_post,
      updated_at = now()
  WHERE id = _group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_group_member_posting(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_member_posting(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Owner can tag own post to a group they belong to"
ON public.post_groups;
CREATE POLICY "Owner can tag own post to an allowed group"
ON public.post_groups
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_owns_post(post_id)
  AND public.can_post_to_group(auth.uid(), group_id)
);

CREATE OR REPLACE FUNCTION public.current_user_owns_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = _event_id
      AND e.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.current_user_owns_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_owns_event(uuid) TO authenticated;

DROP POLICY IF EXISTS "Owner can tag own event to a group they belong to"
ON public.event_groups;
CREATE POLICY "Owner can tag own event to an allowed group"
ON public.event_groups
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_owns_event(event_id)
  AND public.can_post_to_group(auth.uid(), group_id)
);

CREATE OR REPLACE FUNCTION public.can_view_event(event_row public.events)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN event_row.visibility = 'group' THEN
      EXISTS (
        SELECT 1
        FROM public.event_groups eg
        WHERE eg.event_id = event_row.id
          AND (
            public.is_group_member(auth.uid(), eg.group_id)
            OR public.is_group_faculty(auth.uid(), eg.group_id)
          )
      )
      OR (
        event_row.user_id = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.event_groups eg
          WHERE eg.event_id = event_row.id
        )
      )
    WHEN event_row.visibility IN ('public', 'unlisted') THEN true
    WHEN event_row.user_id = auth.uid() THEN true
    WHEN public.has_role(auth.uid(), 'admin') THEN true
    WHEN event_row.visibility = 'network' THEN EXISTS (
      SELECT 1
      FROM public.connections c1
      INNER JOIN public.connections c2
        ON c1.follower_id = c2.following_id
       AND c1.following_id = c2.follower_id
      WHERE c1.follower_id = event_row.user_id
        AND c1.following_id = auth.uid()
    )
    WHEN event_row.visibility = 'specific' THEN EXISTS (
      SELECT 1
      FROM public.event_recipients
      WHERE event_id = event_row.id
        AND recipient_id = auth.uid()
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.current_user_owns_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.creator_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.current_user_owns_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_owns_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "Project creator can tag own project to a group they belong to"
ON public.project_groups;
CREATE POLICY "Project creator can tag own project to an allowed group"
ON public.project_groups
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_owns_project(project_id)
  AND public.can_post_to_group(auth.uid(), group_id)
);

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

NOTIFY pgrst, 'reload schema';
