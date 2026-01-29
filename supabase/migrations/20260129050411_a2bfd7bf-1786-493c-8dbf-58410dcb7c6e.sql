-- Create table for "Get to Know Me" flipbook photos
CREATE TABLE public.profile_flipbook (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profile_flipbook ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view flipbook photos"
ON public.profile_flipbook
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own flipbook photos"
ON public.profile_flipbook
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flipbook photos"
ON public.profile_flipbook
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flipbook photos"
ON public.profile_flipbook
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_profile_flipbook_user_id ON public.profile_flipbook(user_id, display_order);