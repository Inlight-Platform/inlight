BEGIN;

-- INV96 Group 3: only verified credits are public; owners and admins retain full reads.
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Credits are viewable by everyone" ON public.credits;
DROP POLICY IF EXISTS "Verified credits are publicly viewable" ON public.credits;
DROP POLICY IF EXISTS "Users can view their own credits" ON public.credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON public.credits;

CREATE POLICY "Verified credits are publicly viewable"
ON public.credits
FOR SELECT
TO anon, authenticated
USING (verified IS TRUE);

CREATE POLICY "Users can view their own credits"
ON public.credits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits"
ON public.credits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP POLICY IF EXISTS "Verified credits are publicly viewable" ON public.credits;
DROP POLICY IF EXISTS "Users can view their own credits" ON public.credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON public.credits;

CREATE POLICY "Credits are viewable by everyone"
ON public.credits
FOR SELECT
USING (true);

COMMIT;
*/
