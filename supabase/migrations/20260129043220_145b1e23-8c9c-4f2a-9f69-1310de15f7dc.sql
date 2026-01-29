-- Allow admins to update any nyc_shows entry (for managing cover photos)
CREATE POLICY "Admins can update any show"
ON public.nyc_shows
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any nyc_shows entry
CREATE POLICY "Admins can delete any show"
ON public.nyc_shows
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert any nyc_shows entry
CREATE POLICY "Admins can insert any show"
ON public.nyc_shows
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));