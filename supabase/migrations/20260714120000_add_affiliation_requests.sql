-- Create affiliation_requests table
CREATE TABLE public.affiliation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_name TEXT NOT NULL,
  description_or_context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX affiliation_requests_user_id_idx ON public.affiliation_requests (user_id);
CREATE INDEX affiliation_requests_status_idx ON public.affiliation_requests (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_affiliation_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER affiliation_requests_updated_at
  BEFORE UPDATE ON public.affiliation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_affiliation_requests_updated_at();

-- Enable RLS
ALTER TABLE public.affiliation_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can create their own affiliation requests"
  ON public.affiliation_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view their own affiliation requests"
  ON public.affiliation_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update (approve/deny) requests
CREATE POLICY "Admins can update affiliation requests"
  ON public.affiliation_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
