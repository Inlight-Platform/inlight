
-- Add google_drive_url to projects
ALTER TABLE public.projects ADD COLUMN google_drive_url text DEFAULT NULL;
