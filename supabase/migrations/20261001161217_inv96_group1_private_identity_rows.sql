BEGIN;

-- INV96 Group 1: identity-bearing relationship rows are private to their owner.
ALTER TABLE public.profile_flipbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_vouches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view flipbook photos" ON public.profile_flipbook;
DROP POLICY IF EXISTS "Users can view their own flipbook photos" ON public.profile_flipbook;
CREATE POLICY "Users can view their own flipbook photos"
ON public.profile_flipbook
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Votes are viewable by everyone" ON public.tip_votes;
DROP POLICY IF EXISTS "Users can view their own votes" ON public.tip_votes;
CREATE POLICY "Users can view their own votes"
ON public.tip_votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can vote" ON public.tip_votes;
CREATE POLICY "Users can vote"
ON public.tip_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their vote" ON public.tip_votes;
CREATE POLICY "Users can remove their vote"
ON public.tip_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vouches are viewable by everyone" ON public.vouches;
DROP POLICY IF EXISTS "Users can view their own vouches" ON public.vouches;
CREATE POLICY "Users can view their own vouches"
ON public.vouches
FOR SELECT
TO authenticated
USING (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Users can vouch for others" ON public.vouches;
CREATE POLICY "Users can vouch for others"
ON public.vouches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Users can remove their vouches" ON public.vouches;
CREATE POLICY "Users can remove their vouches"
ON public.vouches
FOR DELETE
TO authenticated
USING (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Anyone can view credit vouches" ON public.credit_vouches;
DROP POLICY IF EXISTS "Users can view their own credit vouches" ON public.credit_vouches;
CREATE POLICY "Users can view their own credit vouches"
ON public.credit_vouches
FOR SELECT
TO authenticated
USING (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Authenticated users can vouch" ON public.credit_vouches;
CREATE POLICY "Authenticated users can vouch"
ON public.credit_vouches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Users can remove their vouch" ON public.credit_vouches;
CREATE POLICY "Users can remove their vouch"
ON public.credit_vouches
FOR DELETE
TO authenticated
USING (auth.uid() = voucher_id);

CREATE OR REPLACE FUNCTION public.get_credit_vouch_state(_credit_id uuid)
RETURNS TABLE (
  vouch_count bigint,
  has_vouched boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    count(*)::bigint AS vouch_count,
    coalesce(bool_or(cv.voucher_id = auth.uid()), false) AS has_vouched
  FROM public.credit_vouches AS cv
  WHERE cv.credit_id = _credit_id
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_credit_vouch_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_credit_vouch_state(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_credit_vouch_state(uuid) TO authenticated;

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP FUNCTION IF EXISTS public.get_credit_vouch_state(uuid);

DROP POLICY IF EXISTS "Users can view their own credit vouches" ON public.credit_vouches;
DROP POLICY IF EXISTS "Authenticated users can vouch" ON public.credit_vouches;
DROP POLICY IF EXISTS "Users can remove their vouch" ON public.credit_vouches;
CREATE POLICY "Anyone can view credit vouches"
ON public.credit_vouches FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vouch"
ON public.credit_vouches FOR INSERT WITH CHECK (auth.uid() = voucher_id);
CREATE POLICY "Users can remove their vouch"
ON public.credit_vouches FOR DELETE USING (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Users can view their own vouches" ON public.vouches;
DROP POLICY IF EXISTS "Users can vouch for others" ON public.vouches;
DROP POLICY IF EXISTS "Users can remove their vouches" ON public.vouches;
CREATE POLICY "Vouches are viewable by everyone"
ON public.vouches FOR SELECT USING (true);
CREATE POLICY "Users can vouch for others"
ON public.vouches FOR INSERT WITH CHECK (auth.uid() = voucher_id);
CREATE POLICY "Users can remove their vouches"
ON public.vouches FOR DELETE USING (auth.uid() = voucher_id);

DROP POLICY IF EXISTS "Users can view their own votes" ON public.tip_votes;
DROP POLICY IF EXISTS "Users can vote" ON public.tip_votes;
DROP POLICY IF EXISTS "Users can remove their vote" ON public.tip_votes;
CREATE POLICY "Votes are viewable by everyone"
ON public.tip_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote"
ON public.tip_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their vote"
ON public.tip_votes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own flipbook photos" ON public.profile_flipbook;
CREATE POLICY "Anyone can view flipbook photos"
ON public.profile_flipbook FOR SELECT USING (true);

COMMIT;
*/
