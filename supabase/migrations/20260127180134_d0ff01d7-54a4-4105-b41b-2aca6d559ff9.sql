-- Add submitted_by column to track user submissions
ALTER TABLE public.nyc_shows 
ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);

-- Create policy to allow authenticated users to insert their own shows (off-off-broadway only)
CREATE POLICY "Users can submit off-off-broadway shows" 
ON public.nyc_shows 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND submitted_by = auth.uid() 
  AND category = 'off-off-broadway'
);

-- Create policy to allow users to update their own submitted shows
CREATE POLICY "Users can update their own shows" 
ON public.nyc_shows 
FOR UPDATE 
USING (auth.uid() = submitted_by);

-- Create policy to allow users to delete their own submitted shows
CREATE POLICY "Users can delete their own shows" 
ON public.nyc_shows 
FOR DELETE 
USING (auth.uid() = submitted_by);