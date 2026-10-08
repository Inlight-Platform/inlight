-- Verify ownership without selecting through the post visibility policy. This
-- avoids a cycle when a group-only post is linked to its department.
CREATE OR REPLACE FUNCTION public.current_user_owns_post(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = _post_id
      AND p.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.current_user_owns_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_owns_post(uuid) TO authenticated;

DROP POLICY IF EXISTS "Owner can tag own post to a group they belong to"
ON public.post_groups;

CREATE POLICY "Owner can tag own post to a group they belong to"
ON public.post_groups
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_owns_post(post_id)
  AND (
    public.is_group_member(auth.uid(), group_id)
    OR public.is_group_faculty(auth.uid(), group_id)
  )
);

NOTIFY pgrst, 'reload schema';
