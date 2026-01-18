-- Create vouches table for user endorsements
CREATE TABLE public.vouches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL,
  vouched_for_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(voucher_id, vouched_for_id),
  CHECK (voucher_id != vouched_for_id)
);

-- Create indexes for fast lookups
CREATE INDEX idx_vouches_voucher ON public.vouches(voucher_id);
CREATE INDEX idx_vouches_vouched_for ON public.vouches(vouched_for_id);

-- Enable RLS
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;

-- Anyone can view vouches (needed for counts)
CREATE POLICY "Vouches are viewable by everyone"
ON public.vouches
FOR SELECT
USING (true);

-- Authenticated users can vouch for others
CREATE POLICY "Users can vouch for others"
ON public.vouches
FOR INSERT
WITH CHECK (auth.uid() = voucher_id);

-- Users can remove their own vouches
CREATE POLICY "Users can remove their vouches"
ON public.vouches
FOR DELETE
USING (auth.uid() = voucher_id);

-- Add vouch_count column to profiles for efficient querying/sorting
ALTER TABLE public.profiles ADD COLUMN vouch_count INTEGER NOT NULL DEFAULT 0;

-- Create index for sorting by vouch count
CREATE INDEX idx_profiles_vouch_count ON public.profiles(vouch_count DESC);

-- Create function to update vouch count when vouches change
CREATE OR REPLACE FUNCTION public.update_vouch_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET vouch_count = vouch_count + 1 WHERE user_id = NEW.vouched_for_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET vouch_count = GREATEST(0, vouch_count - 1) WHERE user_id = OLD.vouched_for_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers for vouch count updates
CREATE TRIGGER on_vouch_insert
AFTER INSERT ON public.vouches
FOR EACH ROW
EXECUTE FUNCTION public.update_vouch_count();

CREATE TRIGGER on_vouch_delete
AFTER DELETE ON public.vouches
FOR EACH ROW
EXECUTE FUNCTION public.update_vouch_count();