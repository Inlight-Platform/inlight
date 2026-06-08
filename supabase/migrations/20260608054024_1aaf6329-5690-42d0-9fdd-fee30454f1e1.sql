
-- Add company login credentials to request table
ALTER TABLE public.company_account_requests
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS company_password text;

-- Replace deny RPC: simply delete the request (no notification)
DROP FUNCTION IF EXISTS public.deny_company_account_request(uuid, text);
CREATE OR REPLACE FUNCTION public.deny_company_account_request(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  DELETE FROM public.company_account_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
END;
$$;

-- Helper used by edge function to finalize approval after auth user is created
CREATE OR REPLACE FUNCTION public.finalize_company_account_approval(
  _request_id uuid,
  _new_owner_id uuid,
  _admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
  new_company_id uuid;
BEGIN
  -- This runs from edge function with service role; still safe-guard:
  SELECT * INTO req FROM public.company_account_requests WHERE id = _request_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', req.status; END IF;

  INSERT INTO public.companies (name, description, website_url, owner_user_id)
  VALUES (req.company_name, req.description, req.website_url, _new_owner_id)
  RETURNING id INTO new_company_id;

  UPDATE public.company_account_requests
     SET status = 'approved',
         reviewed_by = COALESCE(auth.uid(), _new_owner_id),
         reviewed_at = now(),
         admin_notes = _admin_notes,
         created_company_id = new_company_id,
         company_password = NULL,
         updated_at = now()
   WHERE id = _request_id;

  RETURN new_company_id;
END;
$$;
