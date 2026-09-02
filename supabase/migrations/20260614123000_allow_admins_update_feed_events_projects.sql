DROP POLICY IF EXISTS "Admins can update any event" ON public.events;

CREATE POLICY "Admins can update any event"
ON public.events
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update any project" ON public.projects;

CREATE POLICY "Admins can update any project"
ON public.projects
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
