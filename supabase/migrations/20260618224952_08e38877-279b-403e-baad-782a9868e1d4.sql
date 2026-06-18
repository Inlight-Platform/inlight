
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS mission TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_text_color TEXT,
  ADD COLUMN IF NOT EXISTS fun_facts JSONB NOT NULL DEFAULT '[]'::jsonb;
