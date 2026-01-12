-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert engagement" ON public.user_engagement;
DROP POLICY IF EXISTS "Anyone can update engagement" ON public.user_engagement;

-- Create secure INSERT policy: Only authenticated users can insert their own engagement
CREATE POLICY "Authenticated users can insert their own engagement"
ON public.user_engagement
FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Create secure UPDATE policy: Users can only update their own engagement records
CREATE POLICY "Authenticated users can update their own engagement"
ON public.user_engagement
FOR UPDATE
USING (auth.uid()::text = user_id);

-- Update the SELECT policy to use auth.uid() directly instead of session variable
DROP POLICY IF EXISTS "Users can view their own engagement" ON public.user_engagement;
CREATE POLICY "Users can view their own engagement"
ON public.user_engagement
FOR SELECT
USING (auth.uid()::text = user_id);