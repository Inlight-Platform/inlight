-- Create a function to notify users when they get a new follower
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  -- Get the follower's display name
  SELECT display_name INTO follower_name
  FROM public.profiles
  WHERE user_id = NEW.follower_id;
  
  -- Create notification for the user being followed
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'follow',
    'New follower',
    COALESCE(follower_name, 'Someone') || ' started following you',
    jsonb_build_object('follower_id', NEW.follower_id)
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire on new connections
DROP TRIGGER IF EXISTS on_new_connection ON public.connections;
CREATE TRIGGER on_new_connection
  AFTER INSERT ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_follower();