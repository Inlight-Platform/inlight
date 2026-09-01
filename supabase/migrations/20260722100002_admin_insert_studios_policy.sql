-- Allow admins to insert approved affiliation names into the studios table.
DROP POLICY IF EXISTS "Admins can insert studios" ON public.studios;

CREATE POLICY "Admins can insert studios"
  ON public.studios
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
