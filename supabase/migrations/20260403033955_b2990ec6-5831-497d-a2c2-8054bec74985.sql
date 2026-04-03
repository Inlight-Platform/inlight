CREATE POLICY "Admins can delete any event"
ON public.events
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any project"
ON public.projects
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));