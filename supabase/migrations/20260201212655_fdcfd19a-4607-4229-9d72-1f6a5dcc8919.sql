-- Allow admins to update credits (for verification purposes)
CREATE POLICY "Admins can update credits for verification"
ON public.credits
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));