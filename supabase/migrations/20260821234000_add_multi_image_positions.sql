-- Store per-image crop data for multi-image posts and events.
-- Existing single-image position columns remain for backward compatibility.
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS image_positions JSONB;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS image_positions JSONB;
