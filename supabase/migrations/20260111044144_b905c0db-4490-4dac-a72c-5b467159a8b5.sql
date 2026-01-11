-- Create storage bucket for user profile media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/mp3', 'application/pdf']
);

-- RLS policies for profile-media bucket
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own media
CREATE POLICY "Users can update their own media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-media' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all profile media
CREATE POLICY "Public can view all profile media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-media');

-- Create a table to track user media files
CREATE TABLE public.user_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('photo', 'video', 'audio', 'document')),
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'connections', 'private')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_media
ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;

-- Users can view their own media
CREATE POLICY "Users can view their own media"
ON public.user_media
FOR SELECT
USING (auth.uid() = user_id);

-- Users can view public media from others
CREATE POLICY "Anyone can view public media"
ON public.user_media
FOR SELECT
USING (visibility = 'public');

-- Users can insert their own media
CREATE POLICY "Users can insert their own media"
ON public.user_media
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own media
CREATE POLICY "Users can update their own media"
ON public.user_media
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own media
CREATE POLICY "Users can delete their own media"
ON public.user_media
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_media_updated_at
BEFORE UPDATE ON public.user_media
FOR EACH ROW
EXECUTE FUNCTION public.update_engagement_updated_at();