-- Add message/reason column to vouches table
ALTER TABLE public.vouches 
ADD COLUMN IF NOT EXISTS message TEXT;