-- Allow backend Stripe metadata attachment after an admin-created paid event exists.
-- The admin gate still applies when creating a paid event or changing paid-ticket settings.

CREATE OR REPLACE FUNCTION public.enforce_admin_paid_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_paid, false) IS TRUE
    AND (
      TG_OP = 'INSERT'
      OR COALESCE(OLD.is_paid, false) IS DISTINCT FROM COALESCE(NEW.is_paid, false)
      OR OLD.price IS DISTINCT FROM NEW.price
      OR OLD.currency IS DISTINCT FROM NEW.currency
    )
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
