-- Add content column for text entries in the flipbook
ALTER TABLE public.profile_flipbook 
ADD COLUMN content TEXT DEFAULT NULL;

-- Add content_type column to distinguish between image and text entries
ALTER TABLE public.profile_flipbook 
ADD COLUMN content_type TEXT NOT NULL DEFAULT 'image' CHECK (content_type IN ('image', 'text'));

-- Make image_url nullable since text entries won't have images
ALTER TABLE public.profile_flipbook 
ALTER COLUMN image_url DROP NOT NULL;