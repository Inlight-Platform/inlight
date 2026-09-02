
CREATE TABLE IF NOT EXISTS public.company_account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  company_name text NOT NULL,
  description text,
  website_url text,
  justification text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_account_requests_status_check CHECK (status IN ('pending','approved','denied'))
);

ALTER TABLE public.company_account_requests
  ADD COLUMN IF NOT EXISTS requester_id uuid NOT NULL,
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS justification text NOT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_company_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_account_requests_status_check'
      AND conrelid = 'public.company_account_requests'::regclass
  ) THEN
    ALTER TABLE public.company_account_requests
      ADD CONSTRAINT company_account_requests_status_check
      CHECK (status IN ('pending','approved','denied'));
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON public.company_account_requests TO authenticated;
GRANT ALL ON public.company_account_requests TO service_role;

ALTER TABLE public.company_account_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own company requests"
  ON public.company_account_requests;

CREATE POLICY "Users can create their own company requests"
  ON public.company_account_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users can view their own company requests"
  ON public.company_account_requests;

CREATE POLICY "Users can view their own company requests"
  ON public.company_account_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update company requests"
  ON public.company_account_requests;

CREATE POLICY "Admins can update company requests"
  ON public.company_account_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_company_account_requests_updated_at
  ON public.company_account_requests;

CREATE TRIGGER trg_company_account_requests_updated_at
  BEFORE UPDATE ON public.company_account_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify all admins on new request
CREATE OR REPLACE FUNCTION public.notify_admins_company_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  requester_name text;
  admin_user RECORD;
BEGIN
  SELECT COALESCE(display_name, email) INTO requester_name
    FROM public.profiles WHERE user_id = NEW.requester_id;

  FOR admin_user IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      admin_user.user_id,
      'company_request_new',
      'New company account request',
      COALESCE(requester_name,'Someone') || ' requested "' || NEW.company_name || '"',
      jsonb_build_object('request_id', NEW.id, 'requester_id', NEW.requester_id, 'company_name', NEW.company_name)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_company_request
  ON public.company_account_requests;

CREATE TRIGGER trg_notify_admins_company_request
  AFTER INSERT ON public.company_account_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_company_request();

-- Notify requester on status change
CREATE OR REPLACE FUNCTION public.notify_requester_company_request_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.requester_id,
      'company_request_approved',
      'Company account approved',
      'Your request for "' || NEW.company_name || '" was approved.',
      jsonb_build_object('request_id', NEW.id, 'company_id', NEW.created_company_id, 'company_name', NEW.company_name)
    );
  ELSIF NEW.status = 'denied' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.requester_id,
      'company_request_denied',
      'Company account request denied',
      'Your request for "' || NEW.company_name || '" was not approved.' ||
        CASE WHEN NEW.admin_notes IS NOT NULL AND length(NEW.admin_notes) > 0
             THEN ' Note: ' || NEW.admin_notes ELSE '' END,
      jsonb_build_object('request_id', NEW.id, 'company_name', NEW.company_name)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_requester_company_request_status
  ON public.company_account_requests;

CREATE TRIGGER trg_notify_requester_company_request_status
  AFTER UPDATE ON public.company_account_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_requester_company_request_status();

-- Approve RPC
CREATE OR REPLACE FUNCTION public.approve_company_account_request(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  req RECORD;
  new_company_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO req FROM public.company_account_requests WHERE id = _request_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', req.status; END IF;

  INSERT INTO public.companies (name, description, website_url, owner_user_id)
  VALUES (req.company_name, req.description, req.website_url, req.requester_id)
  RETURNING id INTO new_company_id;

  UPDATE public.company_account_requests
     SET status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         admin_notes = _admin_notes,
         created_company_id = new_company_id,
         updated_at = now()
   WHERE id = _request_id;

  RETURN new_company_id;
END;
$$;

-- Deny RPC
CREATE OR REPLACE FUNCTION public.deny_company_account_request(_request_id uuid, _admin_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.company_account_requests
     SET status = 'denied',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         admin_notes = _admin_notes,
         updated_at = now()
   WHERE id = _request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;
END;
$$;
