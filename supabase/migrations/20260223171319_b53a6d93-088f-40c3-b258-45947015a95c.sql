-- Update the trigger function to use the anon key (publicly available) 
-- since the edge function has verify_jwt = false
CREATE OR REPLACE FUNCTION public.send_notification_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text := 'https://gbiostpdhvfxpppfqskw.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaW9zdHBkaHZmeHBwcGZxc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzk5MzIsImV4cCI6MjA4MzY1NTkzMn0.JnNtO8ai56DAOPPxXbIcGYbWY1i4AB7xgqxdJprs_FA';
  payload jsonb;
BEGIN
  payload := jsonb_build_object('record', row_to_json(NEW));
  
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send notification email: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;