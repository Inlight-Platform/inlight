-- Allow admins to delete any studio posts
CREATE POLICY "Admins can delete any studio posts"
ON public.studio_posts FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));