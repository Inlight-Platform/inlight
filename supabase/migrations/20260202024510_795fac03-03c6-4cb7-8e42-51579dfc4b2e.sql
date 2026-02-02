-- Create opportunity_applications table for job applications
CREATE TABLE public.opportunity_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  applicant_id UUID NOT NULL,
  message TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  additional_materials JSONB DEFAULT '[]'::jsonb,
  include_profile BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.opportunity_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view their own applications"
ON public.opportunity_applications
FOR SELECT
USING (auth.uid() = applicant_id);

-- Users can submit applications
CREATE POLICY "Users can submit applications"
ON public.opportunity_applications
FOR INSERT
WITH CHECK (auth.uid() = applicant_id);

-- Users can update their pending applications
CREATE POLICY "Users can update pending applications"
ON public.opportunity_applications
FOR UPDATE
USING (auth.uid() = applicant_id AND status = 'pending');

-- Users can withdraw their applications
CREATE POLICY "Users can withdraw applications"
ON public.opportunity_applications
FOR DELETE
USING (auth.uid() = applicant_id);

-- Add trigger for updated_at
CREATE TRIGGER update_opportunity_applications_updated_at
BEFORE UPDATE ON public.opportunity_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();