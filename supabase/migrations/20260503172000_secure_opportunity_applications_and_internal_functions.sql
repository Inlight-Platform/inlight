-- Allow opportunity posters to review applications on their own listings,
-- restrict ticket confirmation emails to internal callers, and remove
-- unnecessary public execute access from SECURITY DEFINER functions.

-- 1) Opportunity posters can view applications for their own listings.
CREATE POLICY "Opportunity posters can view received applications"
ON public.opportunity_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.opportunities o
    WHERE o.id::text = opportunity_applications.opportunity_id
      AND o.posted_by = auth.uid()
  )
);

-- 2) Require the internal webhook secret when the ticket-email trigger calls the edge function.
CREATE OR REPLACE FUNCTION public.send_ticket_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  anon_key text;
  webhook_secret text;
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

  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'NOTIFICATION_WEBHOOK_SECRET'
  LIMIT 1;

  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    should_send := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    should_send := true;
  END IF;

  IF NOT should_send THEN
    RETURN NEW;
  END IF;

  IF supabase_url IS NULL OR anon_key IS NULL OR webhook_secret IS NULL THEN
    RAISE WARNING 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or NOTIFICATION_WEBHOOK_SECRET secret for send_ticket_email trigger';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object('ticket_id', NEW.id);

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-ticket-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'x-internal-webhook-secret', webhook_secret
      ),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send ticket email: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3) Remove broad API execution on SECURITY DEFINER functions, then grant back only what the app needs.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arg_list
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.schema_name,
      r.function_name,
      r.arg_list
    );
  END LOOP;
END
$$;

-- Functions needed by RLS policies for anonymous and authenticated reads.
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(public.posts) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_event_rsvps(uuid) TO anon, authenticated;

-- Functions intentionally exposed to authenticated clients as RPCs.
GRANT EXECUTE ON FUNCTION public.get_message_privacy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutual_connections(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_2nd_degree_connections(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_member_by_email(uuid, text, text) TO authenticated;
