-- Add status and is_public columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pre-production',
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Create project_roles table for role slots
CREATE TABLE IF NOT EXISTS public.project_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  assigned_user_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create project_invitations table
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_role_id uuid NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- RLS for project_roles
CREATE POLICY "Anyone can view project roles"
  ON public.project_roles FOR SELECT USING (true);

CREATE POLICY "Project creator can manage roles"
  ON public.project_roles FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT creator_id FROM projects WHERE id = project_id));

CREATE POLICY "Project creator can update roles"
  ON public.project_roles FOR UPDATE
  USING (auth.uid() IN (SELECT creator_id FROM projects WHERE id = project_id));

CREATE POLICY "Project creator can delete roles"
  ON public.project_roles FOR DELETE
  USING (auth.uid() IN (SELECT creator_id FROM projects WHERE id = project_id));

-- RLS for project_invitations
CREATE POLICY "Users can view their own invitations"
  ON public.project_invitations FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Project creator can send invitations"
  ON public.project_invitations FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Invitation receiver can update status"
  ON public.project_invitations FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Add trigger for updated_at on project_roles
CREATE TRIGGER update_project_roles_updated_at
  BEFORE UPDATE ON public.project_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on project_invitations
CREATE TRIGGER update_project_invitations_updated_at
  BEFORE UPDATE ON public.project_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime for invitations
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_invitations;