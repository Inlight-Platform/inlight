-- Create connections table for mutual follow system
-- A connection is confirmed when both users have follow records for each other

CREATE TABLE public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create index for fast lookups
CREATE INDEX idx_connections_follower ON public.connections(follower_id);
CREATE INDEX idx_connections_following ON public.connections(following_id);

-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Anyone can view connections (needed for network discovery)
CREATE POLICY "Connections are viewable by everyone"
ON public.connections
FOR SELECT
USING (true);

-- Users can follow others (insert their own follow records)
CREATE POLICY "Users can follow others"
ON public.connections
FOR INSERT
WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow (delete their own follow records)
CREATE POLICY "Users can unfollow"
ON public.connections
FOR DELETE
USING (auth.uid() = follower_id);

-- Create posts table for social feed
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for feed queries
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view posts (needed for feed)
CREATE POLICY "Posts are viewable by everyone"
ON public.posts
FOR SELECT
USING (true);

-- Users can create their own posts
CREATE POLICY "Users can create their own posts"
ON public.posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
ON public.posts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on posts
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to get mutual connections (1st degree)
CREATE OR REPLACE FUNCTION public.get_mutual_connections(target_user_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c1.following_id AS user_id
  FROM connections c1
  INNER JOIN connections c2 
    ON c1.follower_id = c2.following_id 
    AND c1.following_id = c2.follower_id
  WHERE c1.follower_id = target_user_id;
$$;

-- Create a function to get 2nd degree connections
CREATE OR REPLACE FUNCTION public.get_2nd_degree_connections(target_user_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_degree AS (
    SELECT c1.following_id AS user_id
    FROM connections c1
    INNER JOIN connections c2 
      ON c1.follower_id = c2.following_id 
      AND c1.following_id = c2.follower_id
    WHERE c1.follower_id = target_user_id
  )
  SELECT DISTINCT c1.following_id AS user_id
  FROM first_degree fd
  INNER JOIN connections c1 ON c1.follower_id = fd.user_id
  INNER JOIN connections c2 
    ON c1.follower_id = c2.following_id 
    AND c1.following_id = c2.follower_id
  WHERE c1.following_id != target_user_id
    AND c1.following_id NOT IN (SELECT user_id FROM first_degree);
$$;