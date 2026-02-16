
-- Companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies are viewable by everyone"
ON public.companies FOR SELECT
USING (true);

-- Company follows table
CREATE TABLE public.company_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.company_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follows"
ON public.company_follows FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can follow companies"
ON public.company_follows FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow companies"
ON public.company_follows FOR DELETE
USING (auth.uid() = user_id);

-- Seed Alab Theater
INSERT INTO public.companies (name, description) VALUES ('Alab Theater', 'Theater company');
