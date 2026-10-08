BEGIN;

-- INV96 Group 6: keep signed-in attribution available through read-only
-- browse views while removing literal-true base-table policies.
ALTER TABLE public.show_teammates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view show teammates" ON public.show_teammates;
DROP POLICY IF EXISTS "Show submitter can add teammates" ON public.show_teammates;
DROP POLICY IF EXISTS "Show submitter can remove teammates" ON public.show_teammates;
DROP POLICY IF EXISTS "Teammates can remove themselves" ON public.show_teammates;

CREATE POLICY "Show participants and admins can view teammate rows"
ON public.show_teammates
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.nyc_shows
    WHERE nyc_shows.id = show_teammates.show_id
      AND nyc_shows.submitted_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Show submitter can add teammates"
ON public.show_teammates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT nyc_shows.submitted_by
    FROM public.nyc_shows
    WHERE nyc_shows.id = show_teammates.show_id
  )
);

CREATE POLICY "Show submitter can remove teammates"
ON public.show_teammates
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT nyc_shows.submitted_by
    FROM public.nyc_shows
    WHERE nyc_shows.id = show_teammates.show_id
  )
);

CREATE POLICY "Teammates can remove themselves"
ON public.show_teammates
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tips are viewable by everyone" ON public.show_tips;
DROP POLICY IF EXISTS "Authenticated users can create tips" ON public.show_tips;
DROP POLICY IF EXISTS "Users can delete their own tips" ON public.show_tips;
DROP POLICY IF EXISTS "Users can update their own tips" ON public.show_tips;

CREATE POLICY "Tip authors and admins can view tip rows"
ON public.show_tips
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Authenticated users can create tips"
ON public.show_tips
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tips"
ON public.show_tips
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tips"
ON public.show_tips
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Studios are viewable by everyone" ON public.studios;
DROP POLICY IF EXISTS "Admins can insert studios" ON public.studios;

CREATE POLICY "Admins can view studio rows"
ON public.studios
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert studios"
ON public.studios
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.studio_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.studio_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.studio_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.studio_posts;
DROP POLICY IF EXISTS "Admins can delete any studio posts" ON public.studio_posts;

CREATE POLICY "Post authors and admins can view studio post rows"
ON public.studio_posts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Authenticated users can create posts"
ON public.studio_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
ON public.studio_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
ON public.studio_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any studio posts"
ON public.studio_posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.studio_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.studio_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.studio_comments;

CREATE POLICY "Comment authors and admins can view studio comment rows"
ON public.studio_comments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Authenticated users can create comments"
ON public.studio_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.studio_comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP VIEW IF EXISTS public.show_teammates_browse;
CREATE VIEW public.show_teammates_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, show_id, user_id, role_description, created_at
FROM public.show_teammates;

DROP VIEW IF EXISTS public.show_tips_browse;
CREATE VIEW public.show_tips_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, show_id, user_id, tip_type, content, helpful_count, created_at, updated_at
FROM public.show_tips;

DROP VIEW IF EXISTS public.studios_browse;
CREATE VIEW public.studios_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, name, description, icon, created_at, badge_tag
FROM public.studios;

DROP VIEW IF EXISTS public.studio_posts_browse;
CREATE VIEW public.studio_posts_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, studio_id, user_id, content, image_url, created_at, updated_at
FROM public.studio_posts;

DROP VIEW IF EXISTS public.studio_comments_browse;
CREATE VIEW public.studio_comments_browse
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, post_id, user_id, content, created_at
FROM public.studio_comments;

REVOKE ALL ON public.show_teammates_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.show_tips_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.studios_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.studio_posts_browse FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.studio_comments_browse FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.show_teammates_browse TO authenticated;
GRANT SELECT ON public.show_tips_browse TO authenticated;
GRANT SELECT ON public.studios_browse TO authenticated;
GRANT SELECT ON public.studio_posts_browse TO authenticated;
GRANT SELECT ON public.studio_comments_browse TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP VIEW IF EXISTS public.show_teammates_browse;
DROP VIEW IF EXISTS public.show_tips_browse;
DROP VIEW IF EXISTS public.studios_browse;
DROP VIEW IF EXISTS public.studio_posts_browse;
DROP VIEW IF EXISTS public.studio_comments_browse;

DROP POLICY IF EXISTS "Show participants and admins can view teammate rows" ON public.show_teammates;
DROP POLICY IF EXISTS "Show submitter can add teammates" ON public.show_teammates;
DROP POLICY IF EXISTS "Show submitter can remove teammates" ON public.show_teammates;
DROP POLICY IF EXISTS "Teammates can remove themselves" ON public.show_teammates;
CREATE POLICY "Anyone can view show teammates" ON public.show_teammates FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Show submitter can add teammates" ON public.show_teammates FOR INSERT TO PUBLIC WITH CHECK (auth.uid() IN (SELECT submitted_by FROM public.nyc_shows WHERE id = show_teammates.show_id));
CREATE POLICY "Show submitter can remove teammates" ON public.show_teammates FOR DELETE TO PUBLIC USING (auth.uid() IN (SELECT submitted_by FROM public.nyc_shows WHERE id = show_teammates.show_id));
CREATE POLICY "Teammates can remove themselves" ON public.show_teammates FOR DELETE TO PUBLIC USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tip authors and admins can view tip rows" ON public.show_tips;
DROP POLICY IF EXISTS "Authenticated users can create tips" ON public.show_tips;
DROP POLICY IF EXISTS "Users can delete their own tips" ON public.show_tips;
DROP POLICY IF EXISTS "Users can update their own tips" ON public.show_tips;
CREATE POLICY "Tips are viewable by everyone" ON public.show_tips FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Authenticated users can create tips" ON public.show_tips FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tips" ON public.show_tips FOR DELETE TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own tips" ON public.show_tips FOR UPDATE TO PUBLIC USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view studio rows" ON public.studios;
DROP POLICY IF EXISTS "Admins can insert studios" ON public.studios;
CREATE POLICY "Studios are viewable by everyone" ON public.studios FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Admins can insert studios" ON public.studios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Post authors and admins can view studio post rows" ON public.studio_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.studio_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.studio_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.studio_posts;
DROP POLICY IF EXISTS "Admins can delete any studio posts" ON public.studio_posts;
CREATE POLICY "Posts are viewable by everyone" ON public.studio_posts FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.studio_posts FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.studio_posts FOR DELETE TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.studio_posts FOR UPDATE TO PUBLIC USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any studio posts" ON public.studio_posts FOR DELETE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Comment authors and admins can view studio comment rows" ON public.studio_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.studio_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.studio_comments;
CREATE POLICY "Comments are viewable by everyone" ON public.studio_comments FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.studio_comments FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.studio_comments FOR DELETE TO PUBLIC USING (auth.uid() = user_id);

COMMIT;
*/
