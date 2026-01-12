-- Fix 1: Add length constraints to profiles table
ALTER TABLE public.profiles
ADD CONSTRAINT display_name_max_length CHECK (display_name IS NULL OR LENGTH(display_name) <= 100),
ADD CONSTRAINT headline_max_length CHECK (headline IS NULL OR LENGTH(headline) <= 200),
ADD CONSTRAINT bio_max_length CHECK (bio IS NULL OR LENGTH(bio) <= 2000),
ADD CONSTRAINT location_max_length CHECK (location IS NULL OR LENGTH(location) <= 100),
ADD CONSTRAINT role_max_length CHECK (role IS NULL OR LENGTH(role) <= 100),
ADD CONSTRAINT pronouns_max_length CHECK (pronouns IS NULL OR LENGTH(pronouns) <= 50),
ADD CONSTRAINT union_status_max_length CHECK (union_status IS NULL OR LENGTH(union_status) <= 100),
ADD CONSTRAINT representation_max_length CHECK (representation IS NULL OR LENGTH(representation) <= 200);

-- Fix 2: Update handle_new_user function with input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  safe_display_name TEXT;
BEGIN
  -- Extract and sanitize display name with length limit
  safe_display_name := COALESCE(
    TRIM(SUBSTRING(NEW.raw_user_meta_data->>'display_name' FROM 1 FOR 100)),
    split_part(NEW.email, '@', 1)
  );
  
  -- Fallback if display name is empty after trimming
  IF LENGTH(safe_display_name) = 0 THEN
    safe_display_name := split_part(NEW.email, '@', 1);
  END IF;
  
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, safe_display_name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 3: Fix RLS on profile_views - remove permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert profile views" ON public.profile_views;
DROP POLICY IF EXISTS "Block direct inserts to profile_views" ON public.profile_views;