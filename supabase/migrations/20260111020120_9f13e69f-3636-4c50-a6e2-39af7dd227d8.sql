-- Drop existing permissive INSERT policy on profile_views
DROP POLICY IF EXISTS "Allow anyone to insert profile views" ON public.profile_views;

-- Create a new restrictive policy that blocks all direct inserts
-- Only the edge function using service role can insert
CREATE POLICY "Block direct inserts to profile_views"
ON public.profile_views
FOR INSERT
WITH CHECK (false);

-- The edge function uses service_role key which bypasses RLS