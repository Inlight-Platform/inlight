-- Add message privacy setting to profiles
ALTER TABLE public.profiles 
ADD COLUMN message_privacy text NOT NULL DEFAULT 'mutuals_only';

-- Create messages table for real-time messaging
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create role applications table
CREATE TABLE public.role_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_role_id uuid NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL,
  message text NOT NULL,
  reel_url text,
  resume_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_role_id, applicant_id)
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_applications ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Users can view their own messages"
ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read"
ON public.messages FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their sent messages"
ON public.messages FOR DELETE
USING (auth.uid() = sender_id);

-- Role applications policies
CREATE POLICY "Anyone can view applications for public projects"
ON public.role_applications FOR SELECT
USING (
  auth.uid() = applicant_id OR
  auth.uid() IN (
    SELECT p.creator_id FROM projects p
    JOIN project_roles pr ON pr.project_id = p.id
    WHERE pr.id = role_applications.project_role_id
  )
);

CREATE POLICY "Users can submit applications"
ON public.role_applications FOR INSERT
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicant or project creator can update"
ON public.role_applications FOR UPDATE
USING (
  auth.uid() = applicant_id OR
  auth.uid() IN (
    SELECT p.creator_id FROM projects p
    JOIN project_roles pr ON pr.project_id = p.id
    WHERE pr.id = role_applications.project_role_id
  )
);

CREATE POLICY "Applicant can withdraw application"
ON public.role_applications FOR DELETE
USING (auth.uid() = applicant_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create trigger for role_applications updated_at
CREATE TRIGGER update_role_applications_updated_at
BEFORE UPDATE ON public.role_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();