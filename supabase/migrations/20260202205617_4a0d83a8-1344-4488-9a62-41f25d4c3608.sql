-- Update policy to allow users to submit both off-off-broadway AND school shows
DROP POLICY IF EXISTS "Users can submit off-off-broadway shows" ON public.nyc_shows;

CREATE POLICY "Users can submit off-off-broadway or school shows" 
ON public.nyc_shows 
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL) 
  AND (submitted_by = auth.uid()) 
  AND (category IN ('off-off-broadway', 'school'))
);