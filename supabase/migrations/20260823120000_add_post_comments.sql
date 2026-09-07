-- Post comments for feed items backed by public.posts (regular updates and job posts).
-- Comment visibility inherits the parent post's visibility via public.can_view_post(posts).

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0 AND char_length(content) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_created_at
  ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_created_at
  ON public.post_comments (user_id, created_at DESC);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Readers who can view the parent post can read its comments.
CREATE POLICY "Comments visible to users who can view the parent post"
ON public.post_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND public.can_view_post(p)
  )
);

-- Authenticated users can comment on posts they are allowed to view.
CREATE POLICY "Users can comment on posts they can view"
ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id
      AND public.can_view_post(p)
  )
);

-- No UPDATE policy for v1: comments are immutable.

-- Authors can delete their own comments; the parent post owner,
-- platform admins, and faculty/group moderators can moderate.
CREATE POLICY "Author or moderators can delete comment"
ON public.post_comments FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id AND p.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.post_groups pg
    WHERE pg.post_id = post_comments.post_id
      AND public.is_group_faculty(auth.uid(), pg.group_id)
  )
);

GRANT SELECT ON public.post_comments TO authenticated;
GRANT INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

NOTIFY pgrst, 'reload schema';
