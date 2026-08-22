-- Add image_urls array column to posts for multi-image support
-- Keeps image_url for backward compatibility with existing posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_urls TEXT[];
