
DROP POLICY "Users can delete their own posts" ON public.posts;

CREATE POLICY "Users can delete their own posts or admins can delete any"
ON public.posts
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
);
