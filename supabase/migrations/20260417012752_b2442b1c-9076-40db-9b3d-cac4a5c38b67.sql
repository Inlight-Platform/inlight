ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS link_url text,
ADD COLUMN IF NOT EXISTS link_title text;