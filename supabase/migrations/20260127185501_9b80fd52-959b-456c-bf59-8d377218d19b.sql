-- Add anonymous posting option to nyc_shows
ALTER TABLE public.nyc_shows 
ADD COLUMN is_anonymous boolean DEFAULT false;

-- Create show_teammates table for collaborators
CREATE TABLE public.show_teammates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.nyc_shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(show_id, user_id)
);

-- Enable RLS
ALTER TABLE public.show_teammates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for show_teammates
CREATE POLICY "Anyone can view show teammates"
ON public.show_teammates FOR SELECT
USING (true);

CREATE POLICY "Show submitter can add teammates"
ON public.show_teammates FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT submitted_by FROM public.nyc_shows WHERE id = show_id
  )
);

CREATE POLICY "Show submitter can remove teammates"
ON public.show_teammates FOR DELETE
USING (
  auth.uid() IN (
    SELECT submitted_by FROM public.nyc_shows WHERE id = show_id
  )
);

CREATE POLICY "Teammates can remove themselves"
ON public.show_teammates FOR DELETE
USING (auth.uid() = user_id);