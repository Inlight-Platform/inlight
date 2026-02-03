-- Add stage_name column to profiles for performers who use stage names
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stage_name TEXT;

-- Add cover_url column to user_media for video thumbnails
ALTER TABLE public.user_media 
ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Add image_position columns to posts for storing user-defined image positioning
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS image_position_x INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS image_position_y INTEGER DEFAULT 50;

-- Add image_position columns to user_media for storing user-defined image positioning  
ALTER TABLE public.user_media 
ADD COLUMN IF NOT EXISTS position_x INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS position_y INTEGER DEFAULT 50;

-- Add link_url column to posts for job opportunities (if not exists)
-- Note: This column may already exist, using IF NOT EXISTS pattern
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'link_url') THEN
    ALTER TABLE public.posts ADD COLUMN link_url TEXT;
  END IF;
END $$;