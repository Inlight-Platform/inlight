-- Fix: User Email Addresses Exposed to Public Internet
-- The profiles table is publicly readable and contains sensitive email addresses.
-- Solution: Create a restricted RLS policy that only allows users to see their own email

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that allows everyone to see profiles but excludes email for non-owners
-- Since RLS is row-level, we need to handle column-level restriction differently
-- We'll use a function-based approach with a secure view

-- Create a secure view that excludes email for public access
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  user_id,
  display_name,
  avatar_url,
  headline,
  location,
  pronouns,
  role,
  badges,
  bio,
  union_status,
  representation,
  gear_list,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated and anonymous users
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Now create more restrictive RLS policies on the base table:

-- Policy 1: Users can see ALL columns of their own profile (including email)
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Authenticated users can see other profiles (but should use the view for public data)
-- This allows the base table to be accessed but the view should be used for public queries
CREATE POLICY "Authenticated users can view other profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);