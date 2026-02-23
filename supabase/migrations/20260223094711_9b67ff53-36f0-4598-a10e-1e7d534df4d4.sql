
CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item_title TEXT;
  clean_body TEXT;
BEGIN
  -- Check if this is a shared item message
  IF NEW.content LIKE '__SHARED_ITEM__%' THEN
    -- Extract title from JSON payload
    BEGIN
      item_title := (substring(NEW.content from '__SHARED_ITEM__(.*)__END__')::jsonb)->>'title';
    EXCEPTION WHEN OTHERS THEN
      item_title := 'an item';
    END;
    clean_body := 'Shared: ' || COALESCE(item_title, 'an item');
  ELSE
    clean_body := substring(NEW.content from 1 for 100);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'New message',
    clean_body,
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$function$;
