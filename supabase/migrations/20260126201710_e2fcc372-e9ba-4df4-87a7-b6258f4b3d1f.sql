-- Fix function search paths for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The permissive INSERT policy is intentional - notifications are created by database triggers
-- not directly by users, so they need to be inserted by the system