-- Restore project group chat tables for fresh local database rebuilds.
-- Existing shared/staging databases already have these tables; IF NOT EXISTS keeps this safe there.

CREATE TABLE IF NOT EXISTS public.project_group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_group_chats_project_id_key
ON public.project_group_chats(project_id);

CREATE TABLE IF NOT EXISTS public.group_chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id uuid NOT NULL REFERENCES public.project_group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS group_chat_members_group_chat_id_user_id_key
ON public.group_chat_members(group_chat_id, user_id);

CREATE INDEX IF NOT EXISTS idx_group_chat_members_user_id
ON public.group_chat_members(user_id);

CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id uuid NOT NULL REFERENCES public.project_group_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_chat_id_created_at
ON public.group_chat_messages(group_chat_id, created_at);

ALTER TABLE public.project_group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_project_group_chats_updated_at ON public.project_group_chats;
CREATE TRIGGER update_project_group_chats_updated_at
BEFORE UPDATE ON public.project_group_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
