
CREATE TABLE public.job_post_credits (
  user_id UUID PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_post_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own job credits"
  ON public.job_post_credits
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies = only service role (webhook) can modify.

-- Atomic consume function (safe to call from authenticated client)
CREATE OR REPLACE FUNCTION public.consume_job_credit(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RETURN FALSE;
  END IF;

  UPDATE public.job_post_credits
     SET credits = credits - 1, updated_at = now()
   WHERE user_id = _user_id AND credits > 0
   RETURNING credits INTO _remaining;

  RETURN FOUND;
END;
$$;
