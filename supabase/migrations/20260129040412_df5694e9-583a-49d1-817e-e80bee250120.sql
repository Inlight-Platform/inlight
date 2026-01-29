-- Add admin management policies for broadway_metrics
CREATE POLICY "Admins can insert broadway metrics"
ON public.broadway_metrics
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update broadway metrics"
ON public.broadway_metrics
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete broadway metrics"
ON public.broadway_metrics
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin management policies for film_metrics
CREATE POLICY "Admins can insert film metrics"
ON public.film_metrics
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update film metrics"
ON public.film_metrics
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete film metrics"
ON public.film_metrics
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));