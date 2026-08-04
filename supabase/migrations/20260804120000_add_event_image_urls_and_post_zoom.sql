-- Multi-image support for events
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- Zoom persistence for posts (single-image position+zoom)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_position_zoom NUMERIC DEFAULT 1;
