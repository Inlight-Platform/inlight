-- Trigger-based notifications for group chat messages.
-- Direct client inserts into notifications are blocked by RLS, so this runs
-- with SECURITY DEFINER to write notifications on behalf of senders.

CREATE OR REPLACE FUNCTION public.notify_group_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_name_val TEXT;
  sender_name_val TEXT;
  member_record RECORD;
  preview_text TEXT;
BEGIN
  SELECT name INTO group_name_val
  FROM public.project_group_chats
  WHERE id = NEW.group_chat_id;

  SELECT display_name INTO sender_name_val
  FROM public.profiles_public
  WHERE user_id = NEW.sender_id;

  preview_text := LEFT(NEW.content, 60);
  IF LENGTH(NEW.content) > 60 THEN
    preview_text := preview_text || '…';
  END IF;

  FOR member_record IN
    SELECT user_id
    FROM public.group_chat_members
    WHERE group_chat_id = NEW.group_chat_id
      AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      member_record.user_id,
      'message',
      'New message in ' || COALESCE(group_name_val, 'group chat'),
      COALESCE(sender_name_val, 'Someone') || ': ' || preview_text,
      jsonb_build_object(
        'group_chat_id', NEW.group_chat_id,
        'sender_id', NEW.sender_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_chat_message_insert ON public.group_chat_messages;
CREATE TRIGGER on_group_chat_message_insert
AFTER INSERT ON public.group_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_group_chat_message();
