
CREATE OR REPLACE FUNCTION public.notify_new_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  project_creator_id UUID;
  project_id_val UUID;
  role_name_val TEXT;
  project_title_val TEXT;
BEGIN
  SELECT p.creator_id, p.id, p.title, pr.role_name 
  INTO project_creator_id, project_id_val, project_title_val, role_name_val
  FROM public.project_roles pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = NEW.project_role_id;
  
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    project_creator_id,
    'application',
    'New role application',
    'Someone applied for ' || role_name_val || ' on ' || project_title_val,
    jsonb_build_object('application_id', NEW.id, 'role_id', NEW.project_role_id, 'applicant_id', NEW.applicant_id, 'project_id', project_id_val)
  );
  RETURN NEW;
END;
$function$;
