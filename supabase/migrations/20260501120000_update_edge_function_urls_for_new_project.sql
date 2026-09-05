CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  anon_key text;
  payload jsonb;
BEGIN
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF supabase_url IS NULL OR anon_key IS NULL THEN
    RAISE WARNING 'Missing SUPABASE_URL or SUPABASE_ANON_KEY secret for send_notification_email trigger';
    RETURN NEW;
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.send_ticket_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  anon_key text;
  payload jsonb;
  should_send boolean := false;
BEGIN
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  LIMIT 1;

  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    should_send := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    should_send := true;
  END IF;

  IF NOT should_send THEN
    RETURN NEW;
  END IF;

  IF supabase_url IS NULL OR anon_key IS NULL THEN
    RAISE WARNING 'Missing SUPABASE_URL or SUPABASE_ANON_KEY secret for send_ticket_email trigger';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object('ticket_id', NEW.id);

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-ticket-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send ticket email: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
