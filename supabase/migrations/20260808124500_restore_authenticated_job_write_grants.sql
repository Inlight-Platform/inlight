-- Keep visitor job browsing read-only, while restoring the privileges signed-in
-- users need for the existing opportunity RLS policies and credit trigger.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

UPDATE public.opportunities
SET is_public = true
WHERE is_public IS DISTINCT FROM true;

GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;

GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;

GRANT SELECT ON public.job_post_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_job_credit(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
