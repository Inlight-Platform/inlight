
-- Add company_id column to projects table so projects can be linked to companies
ALTER TABLE public.projects ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_projects_company_id ON public.projects(company_id);

-- Create company_photos table for the photos section
CREATE TABLE public.company_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can view company photos
CREATE POLICY "Anyone can view company photos"
  ON public.company_photos FOR SELECT
  USING (true);

-- Only company owner can insert photos
CREATE POLICY "Company owner can insert photos"
  ON public.company_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = company_id AND owner_user_id = auth.uid()
    )
  );

-- Only company owner can delete photos
CREATE POLICY "Company owner can delete photos"
  ON public.company_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = company_id AND owner_user_id = auth.uid()
    )
  );
