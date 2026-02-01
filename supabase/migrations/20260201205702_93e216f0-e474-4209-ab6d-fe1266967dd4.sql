-- Table for tracking credit vouches from team members
CREATE TABLE public.credit_vouches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(credit_id, voucher_id)
);

-- Table for admin verification requests
CREATE TABLE public.credit_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  materials_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_verification_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_vouches
CREATE POLICY "Anyone can view credit vouches"
ON public.credit_vouches FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can vouch"
ON public.credit_vouches FOR INSERT
WITH CHECK (auth.uid() = voucher_id);

CREATE POLICY "Users can remove their vouch"
ON public.credit_vouches FOR DELETE
USING (auth.uid() = voucher_id);

-- RLS policies for credit_verification_requests
CREATE POLICY "Users can view their own requests"
ON public.credit_verification_requests FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create verification requests"
ON public.credit_verification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update verification requests"
ON public.credit_verification_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete pending requests"
ON public.credit_verification_requests FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Function to auto-verify credits when 2 vouches are received
CREATE OR REPLACE FUNCTION public.check_credit_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vouch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO vouch_count
  FROM public.credit_vouches
  WHERE credit_id = NEW.credit_id;
  
  IF vouch_count >= 2 THEN
    UPDATE public.credits
    SET verified = true, updated_at = now()
    WHERE id = NEW.credit_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to check verification after each vouch
CREATE TRIGGER trigger_check_credit_verification
AFTER INSERT ON public.credit_vouches
FOR EACH ROW
EXECUTE FUNCTION public.check_credit_verification();

-- Add updated_at trigger for verification requests
CREATE TRIGGER update_credit_verification_requests_updated_at
BEFORE UPDATE ON public.credit_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();