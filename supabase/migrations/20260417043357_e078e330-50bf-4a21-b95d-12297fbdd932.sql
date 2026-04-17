
CREATE OR REPLACE FUNCTION public.send_ticket_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text := 'https://gbiostpdhvfxpppfqskw.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaW9zdHBkaHZmeHBwcGZxc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzk5MzIsImV4cCI6MjA4MzY1NTkzMn0.JnNtO8ai56DAOPPxXbIcGYbWY1i4AB7xgqxdJprs_FA';
  payload jsonb;
  should_send boolean := false;
BEGIN
  -- Send when ticket is newly created as confirmed, OR transitions to confirmed
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    should_send := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    should_send := true;
  END IF;

  IF NOT should_send THEN
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

DROP TRIGGER IF EXISTS trigger_send_ticket_email ON public.tickets;
CREATE TRIGGER trigger_send_ticket_email
AFTER INSERT OR UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.send_ticket_email();

-- Ensure the mark_rsvp_attended trigger exists (it should, but make idempotent)
DROP TRIGGER IF EXISTS trigger_mark_rsvp_attended ON public.tickets;
CREATE TRIGGER trigger_mark_rsvp_attended
AFTER UPDATE OF checked_in_at ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.mark_rsvp_attended();
