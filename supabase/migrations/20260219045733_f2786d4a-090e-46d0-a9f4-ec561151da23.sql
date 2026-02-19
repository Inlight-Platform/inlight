
-- Add visibility column to posts
ALTER TABLE public.posts 
ADD COLUMN visibility text NOT NULL DEFAULT 'public';

-- Create table for specific post recipients
CREATE TABLE public.post_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint
ALTER TABLE public.post_recipients ADD CONSTRAINT unique_post_recipient UNIQUE (post_id, recipient_id);

-- Enable RLS
ALTER TABLE public.post_recipients ENABLE ROW LEVEL SECURITY;

-- RLS for post_recipients: post owner can manage
CREATE POLICY "Post owner can insert recipients"
ON public.post_recipients FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.posts WHERE id = post_id)
);

CREATE POLICY "Post owner can delete recipients"
ON public.post_recipients FOR DELETE
USING (
  auth.uid() IN (SELECT user_id FROM public.posts WHERE id = post_id)
);

-- Recipients and post owner can view
CREATE POLICY "Post owner and recipients can view"
ON public.post_recipients FOR SELECT
USING (
  auth.uid() = recipient_id OR
  auth.uid() IN (SELECT user_id FROM public.posts WHERE id = post_id)
);

-- Create a security definer function to check post visibility
CREATE OR REPLACE FUNCTION public.can_view_post(post_row public.posts)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Public posts visible to all
    WHEN post_row.visibility = 'public' THEN true
    -- Own posts always visible
    WHEN post_row.user_id = auth.uid() THEN true
    -- Network posts visible to 1st degree connections
    WHEN post_row.visibility = 'network' THEN EXISTS (
      SELECT 1 FROM connections c1
      INNER JOIN connections c2 
        ON c1.follower_id = c2.following_id 
        AND c1.following_id = c2.follower_id
      WHERE c1.follower_id = post_row.user_id
        AND c1.following_id = auth.uid()
    )
    -- Specific posts visible only to listed recipients
    WHEN post_row.visibility = 'specific' THEN EXISTS (
      SELECT 1 FROM post_recipients
      WHERE post_id = post_row.id
        AND recipient_id = auth.uid()
    )
    ELSE false
  END
$$;

-- Drop old SELECT policy and replace with visibility-aware one
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

CREATE POLICY "Posts are viewable based on visibility"
ON public.posts FOR SELECT
USING (public.can_view_post(posts));
