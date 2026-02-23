
-- Unified saved_items table for resources and jobs (projects/shows already have their own tables)
CREATE TABLE public.saved_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'resource', 'job', 'open_role'
  item_id TEXT, -- nullable, for DB-backed items (e.g. project_role ID for open roles)
  item_title TEXT NOT NULL,
  item_url TEXT, -- external URL for resources
  item_metadata JSONB DEFAULT '{}'::jsonb, -- extra info like description, category, etc.
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicate saves
ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_unique_save UNIQUE (user_id, item_type, item_title, item_url);

-- Enable RLS
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved items
CREATE POLICY "Users can view their own saved items"
ON public.saved_items FOR SELECT
USING (auth.uid() = user_id);

-- Users can save items
CREATE POLICY "Users can save items"
ON public.saved_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unsave items
CREATE POLICY "Users can unsave items"
ON public.saved_items FOR DELETE
USING (auth.uid() = user_id);
