-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'message', 'application', 'invitation', 'application_response', 'invitation_response'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- System can create notifications (via service role or triggers)
CREATE POLICY "Users can receive notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Users can mark their notifications as read
CREATE POLICY "Users can update their notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their notifications
CREATE POLICY "Users can delete their notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Add email notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to auto-create notification on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'New message',
    substring(NEW.content from 1 for 100),
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new messages
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Create function to auto-create notification on new role application
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS TRIGGER AS $$
DECLARE
  project_creator_id UUID;
  role_name_val TEXT;
  project_title_val TEXT;
BEGIN
  SELECT p.creator_id, p.title, pr.role_name 
  INTO project_creator_id, project_title_val, role_name_val
  FROM public.project_roles pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = NEW.project_role_id;
  
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    project_creator_id,
    'application',
    'New role application',
    'Someone applied for ' || role_name_val || ' on ' || project_title_val,
    jsonb_build_object('application_id', NEW.id, 'role_id', NEW.project_role_id, 'applicant_id', NEW.applicant_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new applications
CREATE TRIGGER on_new_application
  AFTER INSERT ON public.role_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_application();

-- Create function to notify on invitation
CREATE OR REPLACE FUNCTION public.notify_new_invitation()
RETURNS TRIGGER AS $$
DECLARE
  role_name_val TEXT;
  project_title_val TEXT;
BEGIN
  SELECT p.title, pr.role_name 
  INTO project_title_val, role_name_val
  FROM public.project_roles pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = NEW.project_role_id;
  
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'invitation',
    'Project invitation',
    'You''ve been invited to join ' || project_title_val || ' as ' || role_name_val,
    jsonb_build_object('invitation_id', NEW.id, 'role_id', NEW.project_role_id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new invitations
CREATE TRIGGER on_new_invitation
  AFTER INSERT ON public.project_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_invitation();