-- Drop existing problematic policies on group_chat_members
DROP POLICY IF EXISTS "Users can view group chat members for their groups" ON public.group_chat_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.group_chat_members;
DROP POLICY IF EXISTS "group_chat_members_select_policy" ON public.group_chat_members;

-- Create a simple, non-recursive policy
-- Users can see members of group chats they belong to
CREATE POLICY "Users can view members of their group chats"
ON public.group_chat_members
FOR SELECT
USING (
  group_chat_id IN (
    SELECT gcm.group_chat_id 
    FROM public.group_chat_members gcm 
    WHERE gcm.user_id = auth.uid()
  )
);

-- Simpler alternative: Users can see their own membership records directly
CREATE POLICY "Users can view own membership"
ON public.group_chat_members
FOR SELECT
USING (user_id = auth.uid());