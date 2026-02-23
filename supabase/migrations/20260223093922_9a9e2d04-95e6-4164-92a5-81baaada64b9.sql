
-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'job',
  status TEXT NOT NULL DEFAULT 'open',
  posted_by UUID NOT NULL,
  company TEXT,
  location TEXT DEFAULT 'Remote',
  is_remote BOOLEAN NOT NULL DEFAULT false,
  compensation TEXT,
  experience_level TEXT NOT NULL DEFAULT 'any',
  roles TEXT[] NOT NULL DEFAULT '{}',
  requirements TEXT[] NOT NULL DEFAULT '{}',
  deadline TEXT,
  start_date TEXT,
  duration TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Everyone can view opportunities
CREATE POLICY "Opportunities are viewable by everyone"
  ON public.opportunities FOR SELECT
  USING (true);

-- Authenticated users can create opportunities
CREATE POLICY "Users can create opportunities"
  ON public.opportunities FOR INSERT
  WITH CHECK (auth.uid() = posted_by);

-- Users can update their own opportunities
CREATE POLICY "Users can update their own opportunities"
  ON public.opportunities FOR UPDATE
  USING (auth.uid() = posted_by);

-- Users can delete their own opportunities
CREATE POLICY "Users can delete their own opportunities"
  ON public.opportunities FOR DELETE
  USING (auth.uid() = posted_by);

-- Admins can manage all opportunities
CREATE POLICY "Admins can manage all opportunities"
  ON public.opportunities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
