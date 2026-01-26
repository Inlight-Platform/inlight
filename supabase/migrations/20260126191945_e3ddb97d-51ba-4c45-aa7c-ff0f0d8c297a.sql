-- Add header_image_url column to projects table
ALTER TABLE public.projects 
ADD COLUMN header_image_url TEXT;