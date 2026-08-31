-- Add image_position columns to events for storing user-defined image positioning
ALTER TABLE events
ADD COLUMN IF NOT EXISTS image_position_x INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS image_position_y INTEGER DEFAULT 50;
