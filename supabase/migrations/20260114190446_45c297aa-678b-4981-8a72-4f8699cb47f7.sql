-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create studios table for NYU studio categories
CREATE TABLE public.studios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create studio posts table
CREATE TABLE public.studio_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create studio comments table
CREATE TABLE public.studio_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.studio_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_comments ENABLE ROW LEVEL SECURITY;

-- Studios are viewable by everyone
CREATE POLICY "Studios are viewable by everyone" 
ON public.studios FOR SELECT USING (true);

-- Posts are viewable by everyone
CREATE POLICY "Posts are viewable by everyone" 
ON public.studio_posts FOR SELECT USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts" 
ON public.studio_posts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts" 
ON public.studio_posts FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts" 
ON public.studio_posts FOR DELETE 
USING (auth.uid() = user_id);

-- Comments are viewable by everyone
CREATE POLICY "Comments are viewable by everyone" 
ON public.studio_comments FOR SELECT USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" 
ON public.studio_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" 
ON public.studio_comments FOR DELETE 
USING (auth.uid() = user_id);

-- Insert the 8 NYU studios
INSERT INTO public.studios (name, description, icon) VALUES
  ('Experimental Theatre Wing', 'ETW - Avant-garde performance and devised theater', '🎭'),
  ('New Studio on Broadway', 'Classical training with Broadway industry connections', '🎪'),
  ('Atlantic Theater Company', 'Practical Aesthetics acting technique', '🌊'),
  ('Stonestreet Studios', 'Film and television acting conservatory', '🎬'),
  ('Playwrights Horizons', 'New play development and collaboration', '✍️'),
  ('Classical Studio', 'Shakespeare and classical text work', '📜'),
  ('Graduate Acting', 'MFA graduate acting program', '🎓'),
  ('Musical Theatre', 'Triple-threat training for the stage', '🎵');

-- Create trigger for updated_at
CREATE TRIGGER update_studio_posts_updated_at
BEFORE UPDATE ON public.studio_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();