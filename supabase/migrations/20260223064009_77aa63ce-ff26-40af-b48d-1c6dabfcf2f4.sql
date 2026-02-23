
-- Fix: make the trigger non-blocking and use the correct Supabase URL
-- The trigger should not prevent inserts if the email sending fails
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://gbiostpdhvfxpppfqskw.supabase.co';
  service_key text;
  payload jsonb;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' 
  LIMIT 1;
  
  -- Only attempt if we have the key
  IF service_key IS NOT NULL THEN
    payload := jsonb_build_object('record', row_to_json(NEW));
    
    BEGIN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := payload
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't block the insert
      RAISE WARNING 'Failed to send notification email: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;
