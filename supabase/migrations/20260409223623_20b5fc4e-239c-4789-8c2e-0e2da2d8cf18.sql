
-- Create function to notify users when a job matches their skillset
CREATE OR REPLACE FUNCTION public.notify_matching_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  matching_user RECORD;
BEGIN
  -- Find users whose role matches any of the opportunity's roles
  FOR matching_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.role IS NOT NULL
      AND p.user_id != NEW.posted_by
      AND EXISTS (
        SELECT 1
        FROM unnest(NEW.roles) AS opp_role
        WHERE LOWER(TRIM(opp_role)) = LOWER(TRIM(p.role))
      )
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      matching_user.user_id,
      'job_match',
      'New opportunity matching your role',
      NEW.title || ' is looking for your skillset',
      jsonb_build_object(
        'opportunity_id', NEW.id,
        'opportunity_title', NEW.title,
        'matched_roles', NEW.roles
      )
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Create trigger on opportunities table
CREATE TRIGGER on_new_opportunity_notify_matches
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_job();
