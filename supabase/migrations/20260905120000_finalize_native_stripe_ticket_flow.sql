-- Finalize native Stripe ticketing for live event checkout.
-- Revenue is collected into Inlight's configured Stripe account; creator
-- payouts are recorded for manual admin review, not paid through Stripe Connect.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_email text,
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expired_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_tickets_stripe_payment_intent_id
  ON public.tickets(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_event_status
  ON public.tickets(event_id, status);

CREATE OR REPLACE FUNCTION public.enforce_admin_paid_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_paid, false) IS TRUE
    AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Only Inlight admins can create paid events';
  END IF;

  IF COALESCE(NEW.is_paid, false) IS FALSE THEN
    NEW.price := NULL;
    NEW.currency := COALESCE(NEW.currency, 'usd');
    NEW.stripe_price_id := NULL;
    NEW.payment_link_url := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_paid_events_trigger ON public.events;
CREATE TRIGGER enforce_admin_paid_events_trigger
BEFORE INSERT OR UPDATE OF is_paid, price, currency, stripe_price_id, payment_link_url
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_admin_paid_events();

CREATE OR REPLACE FUNCTION public.get_admin_ticket_revenue_totals()
RETURNS TABLE (
  event_id uuid,
  event_title text,
  event_date timestamp with time zone,
  creator_user_id uuid,
  creator_name text,
  creator_email text,
  tickets_sold bigint,
  gross_revenue numeric,
  refunds numeric,
  net_revenue numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS event_id,
    e.title AS event_title,
    e.event_date,
    e.user_id AS creator_user_id,
    COALESCE(p.display_name, au.raw_user_meta_data->>'display_name') AS creator_name,
    COALESCE(p.email, au.email) AS creator_email,
    COUNT(t.id) FILTER (WHERE t.status IN ('confirmed', 'refunded', 'partially_refunded')) AS tickets_sold,
    COALESCE(SUM(COALESCE(t.amount_paid, 0)) FILTER (WHERE t.status IN ('confirmed', 'refunded', 'partially_refunded')), 0)::numeric AS gross_revenue,
    COALESCE(SUM(COALESCE(t.refunded_amount, 0)) FILTER (WHERE t.status IN ('confirmed', 'refunded', 'partially_refunded')), 0)::numeric AS refunds,
    (
      COALESCE(SUM(COALESCE(t.amount_paid, 0)) FILTER (WHERE t.status IN ('confirmed', 'refunded', 'partially_refunded')), 0)
      - COALESCE(SUM(COALESCE(t.refunded_amount, 0)) FILTER (WHERE t.status IN ('confirmed', 'refunded', 'partially_refunded')), 0)
    )::numeric AS net_revenue
  FROM public.events e
  LEFT JOIN public.tickets t ON t.event_id = e.id
  LEFT JOIN public.profiles p ON p.user_id = e.user_id
  LEFT JOIN auth.users au ON au.id = e.user_id
  WHERE e.is_paid IS TRUE
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  GROUP BY e.id, e.title, e.event_date, e.user_id, p.display_name, p.email, au.email, au.raw_user_meta_data
  ORDER BY e.event_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_ticket_revenue_totals() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;

DROP FUNCTION IF EXISTS public.get_public_event_ticket_attendees(uuid);

CREATE OR REPLACE FUNCTION public.get_public_event_ticket_attendees(target_event_id uuid)
RETURNS TABLE (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  created_at timestamptz,
  is_anonymous boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH masked_tickets AS (
    SELECT
      t.*,
      pp.display_name,
      pp.avatar_url,
      COALESCE(p.anonymous_event_rsvps, false) AS should_mask_attendee
    FROM public.tickets t
    LEFT JOIN public.profiles p
      ON p.user_id = t.user_id
    LEFT JOIN public.profiles_public pp
      ON pp.user_id = t.user_id
    WHERE t.event_id = target_event_id
      AND t.status IN ('confirmed', 'partially_refunded')
  )
  SELECT
    t.id,
    t.event_id,
    CASE
      WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL
      ELSE t.user_id
    END AS user_id,
    CASE
      WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN 'Anonymous attendee'
      ELSE COALESCE(t.display_name, t.attendee_name, 'Inlight Member')
    END AS name,
    CASE
      WHEN t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL
      ELSE t.avatar_url
    END AS avatar_url,
    t.created_at,
    t.should_mask_attendee AND t.user_id IS DISTINCT FROM auth.uid() AS is_anonymous
  FROM masked_tickets t
  ORDER BY t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_ticket_attendees(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
