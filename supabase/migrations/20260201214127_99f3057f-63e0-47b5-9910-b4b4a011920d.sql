-- Add link fields to events table
ALTER TABLE public.events 
ADD COLUMN link_url text,
ADD COLUMN link_title text;