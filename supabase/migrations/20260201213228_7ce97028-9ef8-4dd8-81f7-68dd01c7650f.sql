-- Add link fields to posts table
ALTER TABLE public.posts 
ADD COLUMN link_url text,
ADD COLUMN link_title text;