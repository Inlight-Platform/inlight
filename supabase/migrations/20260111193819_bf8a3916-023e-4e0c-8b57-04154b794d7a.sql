-- Add missing profile fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS union_status TEXT,
ADD COLUMN IF NOT EXISTS representation TEXT,
ADD COLUMN IF NOT EXISTS gear_list TEXT[] DEFAULT '{}'::TEXT[];

-- Create credits table for user credits
CREATE TABLE public.credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project TEXT NOT NULL,
  role TEXT NOT NULL,
  year INTEGER NOT NULL,
  company TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on credits table
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- RLS policies for credits
CREATE POLICY "Credits are viewable by everyone"
ON public.credits
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own credits"
ON public.credits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
ON public.credits
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credits"
ON public.credits
FOR DELETE
USING (auth.uid() = user_id);