-- Use only trusted configured URLs for checkout redirects, lock down profile view reads,
-- and move accepted-application notifications fully server-side.

-- 1) Fix profile view history policy to rely on authenticated identity.
DROP POLICY IF EXISTS "Users can view their own profile views" ON public.profile_views;

CREATE POLICY "Users can view their own profile views"
ON public.profile_views
FOR SELECT
USING (viewed_profile_id = auth.uid()::text);

-- 2) Generate application-accepted notifications in the database on status transition.
CREATE OR REPLACE FUNCTION public.notify_role_application_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_title_val TEXT;
  role_name_val TEXT;
  project_id_val UUID;
  project_creator_id UUID;
BEGIN
  IF NEW.status = 'accepted' AND COALESCE(OLD.status, '') <> 'accepted' THEN
    SELECT pr.project_id, p.title, pr.role_name, p.creator_id
    INTO project_id_val, project_title_val, role_name_val, project_creator_id
    FROM public.project_roles pr
    JOIN public.projects p ON p.id = pr.project_id
    WHERE pr.id = NEW.project_role_id;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.applicant_id,
      'application_accepted',
      'Congratulations! You''ve been accepted!',
      'You''ve been offered the role of ' || COALESCE(role_name_val, 'a role') || ' on ' || COALESCE(project_title_val, 'a project'),
      jsonb_build_object(
        'sender_id', project_creator_id,
        'project_id', project_id_val,
        'role_id', NEW.project_role_id,
        'role_name', COALESCE(role_name_val, ''),
        'project_title', COALESCE(project_title_val, '')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_role_application_accepted ON public.role_applications;
CREATE TRIGGER on_role_application_accepted
AFTER UPDATE ON public.role_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_role_application_accepted();

-- 3) Remove direct client inserts into notifications.
DROP POLICY IF EXISTS "Users can receive notifications" ON public.notifications;
