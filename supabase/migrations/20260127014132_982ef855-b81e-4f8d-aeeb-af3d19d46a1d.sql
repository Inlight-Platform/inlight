-- Create connection_requests table
CREATE TABLE public.connection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- Policies: users can view requests they sent or received
CREATE POLICY "Users can view their connection requests"
ON public.connection_requests
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create requests (as sender)
CREATE POLICY "Users can send connection requests"
ON public.connection_requests
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (to accept/reject)
CREATE POLICY "Users can respond to received requests"
ON public.connection_requests
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Users can delete their own sent requests
CREATE POLICY "Users can cancel their sent requests"
ON public.connection_requests
FOR DELETE
USING (auth.uid() = sender_id);

-- Create trigger for updated_at
CREATE TRIGGER update_connection_requests_updated_at
BEFORE UPDATE ON public.connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to send notification when request is created
CREATE OR REPLACE FUNCTION public.notify_connection_request()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender's display name
  SELECT display_name INTO sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id;

  -- Create notification for receiver
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'connection_request',
    COALESCE(sender_name, 'Someone') || ' wants to connect',
    'Accept to add them to your network',
    jsonb_build_object('sender_id', NEW.sender_id, 'request_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_request_created
AFTER INSERT ON public.connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_connection_request();

-- Create trigger to handle accepted requests (create mutual connections)
CREATE OR REPLACE FUNCTION public.handle_connection_request_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create mutual connections
    INSERT INTO public.connections (follower_id, following_id)
    VALUES (NEW.sender_id, NEW.receiver_id)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.connections (follower_id, following_id)
    VALUES (NEW.receiver_id, NEW.sender_id)
    ON CONFLICT DO NOTHING;

    -- Notify sender that request was accepted
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT 
      NEW.sender_id,
      'connection_request_accepted',
      COALESCE(p.display_name, 'Someone') || ' accepted your connection request',
      'You are now connected',
      jsonb_build_object('user_id', NEW.receiver_id)
    FROM public.profiles p
    WHERE p.user_id = NEW.receiver_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_request_response
AFTER UPDATE ON public.connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_connection_request_response();