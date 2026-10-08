-- Group-only posts require current department access, including for their authors.
CREATE OR REPLACE FUNCTION public.can_view_post(post_row public.posts)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN post_row.visibility = 'group' THEN EXISTS (
      SELECT 1
      FROM public.post_groups pg
      WHERE pg.post_id = post_row.id
        AND (
          public.is_group_member(auth.uid(), pg.group_id)
          OR public.is_group_faculty(auth.uid(), pg.group_id)
        )
    )
    WHEN post_row.visibility = 'public' THEN true
    WHEN post_row.user_id = auth.uid() THEN true
    WHEN post_row.visibility = 'network' THEN EXISTS (
      SELECT 1
      FROM public.connections c1
      INNER JOIN public.connections c2
        ON c1.follower_id = c2.following_id
       AND c1.following_id = c2.follower_id
      WHERE c1.follower_id = post_row.user_id
        AND c1.following_id = auth.uid()
    )
    WHEN post_row.visibility = 'specific' THEN EXISTS (
      SELECT 1
      FROM public.post_recipients
      WHERE post_id = post_row.id
        AND recipient_id = auth.uid()
    )
    ELSE false
  END
$$;

NOTIFY pgrst, 'reload schema';
