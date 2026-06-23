-- Bring production company profiles in line with the customization UI.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS mission TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_text_color TEXT,
  ADD COLUMN IF NOT EXISTS fun_facts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- The company profile UI accepts image/*, including modern and vector formats.
UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800),
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/tiff',
    'image/bmp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'application/pdf'
  ]
WHERE id = 'profile-media';

NOTIFY pgrst, 'reload schema';
