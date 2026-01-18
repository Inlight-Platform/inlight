-- Add category column to projects table
ALTER TABLE public.projects 
ADD COLUMN category TEXT DEFAULT 'other';

-- Create an index for efficient filtering
CREATE INDEX idx_projects_category ON public.projects(category);