-- Create a trigger function to notify users of new connection requests
CREATE OR REPLACE FUNCTION public.notify_connection_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender's display name
  SELECT COALESCE(display_name, email) INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  -- Create notification for the receiver
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'connection_request',
    'New connection request',
    sender_name || ' wants to connect with you',
    jsonb_build_object('sender_id', NEW.sender_id, 'request_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_connection_request_created ON public.connection_requests;
CREATE TRIGGER on_connection_request_created
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_connection_request();