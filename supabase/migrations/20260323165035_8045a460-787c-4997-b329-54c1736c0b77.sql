
-- Showcase profiles: links users to showcase programs
CREATE TABLE public.showcase_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_name TEXT NOT NULL,
  program_slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  headshot_url TEXT,
  reel_url TEXT,
  resume_url TEXT,
  bio_override TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_slug)
);

-- Enable RLS
ALTER TABLE public.showcase_profiles ENABLE ROW LEVEL SECURITY;

-- Public can view active showcase profiles (for the public landing page)
CREATE POLICY "Showcase profiles are publicly readable"
  ON public.showcase_profiles FOR SELECT
  USING (is_active = true);

-- Users can manage their own showcase profiles
CREATE POLICY "Users can insert their own showcase profile"
  ON public.showcase_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own showcase profile"
  ON public.showcase_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own showcase profile"
  ON public.showcase_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all showcase profiles
CREATE POLICY "Admins can manage all showcase profiles"
  ON public.showcase_profiles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Showcase programs table (admin-managed list of programs)
CREATE TABLE public.showcase_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.showcase_programs ENABLE ROW LEVEL SECURITY;

-- Public can view active programs
CREATE POLICY "Showcase programs are publicly readable"
  ON public.showcase_programs FOR SELECT
  USING (is_active = true);

-- Admins can manage programs
CREATE POLICY "Admins can manage showcase programs"
  ON public.showcase_programs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
