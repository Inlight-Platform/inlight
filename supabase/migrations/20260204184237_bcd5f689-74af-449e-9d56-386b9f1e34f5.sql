-- Fix team chats not showing: remove recursive/broken RLS policies and replace with safe ones

-- 1) group_chat_members: drop ALL existing policies (some may be recursive)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_chat_members'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_chat_members', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

-- Allow a user to read only their own membership rows (enough to list their team chats)
CREATE POLICY "Users can view their group memberships"
ON public.group_chat_members
FOR SELECT
USING (user_id = auth.uid());


-- 2) project_group_chats: drop ALL existing policies, recreate correct membership-based read
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_group_chats'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_group_chats', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.project_group_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group chats"
ON public.project_group_chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.group_chat_members gcm
    WHERE gcm.group_chat_id = project_group_chats.id
      AND gcm.user_id = auth.uid()
  )
);


-- 3) Fix linter warning: overly permissive notifications INSERT policy (WITH CHECK true)
-- Tighten it so only users inserting their own notifications are allowed (server-side triggers still work).
DROP POLICY IF EXISTS "Users can receive notifications" ON public.notifications;
CREATE POLICY "Users can receive notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);
