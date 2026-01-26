-- Add post_approval_required column to projects table
ALTER TABLE public.projects 
ADD COLUMN post_approval_required boolean NOT NULL DEFAULT false;

-- Add timeline fields to projects table  
ALTER TABLE public.projects
ADD COLUMN start_date date,
ADD COLUMN end_date date;