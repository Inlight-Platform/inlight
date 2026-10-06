BEGIN;

-- RLS does not govern TRUNCATE. Replace default broad table grants with the
-- exact operations used by the authenticated application paths.
REVOKE ALL ON public.streaming_content FROM authenticated;
REVOKE ALL ON public.film_metrics FROM authenticated;
REVOKE ALL ON public.broadway_metrics FROM authenticated;
REVOKE ALL ON public.industry_highlights FROM authenticated;
REVOKE ALL ON public.opportunities FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.streaming_content TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.film_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadway_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.industry_highlights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

GRANT ALL ON public.streaming_content TO authenticated;
GRANT ALL ON public.film_metrics TO authenticated;
GRANT ALL ON public.broadway_metrics TO authenticated;
GRANT ALL ON public.industry_highlights TO authenticated;
GRANT ALL ON public.opportunities TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
