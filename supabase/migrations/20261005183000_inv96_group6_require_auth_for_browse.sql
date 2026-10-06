BEGIN;

-- The Group 6 owner decision requires authentication for teammate, tip, and
-- studio presentation data, including attribution exposed by the browse views.
REVOKE ALL ON public.show_teammates_browse FROM PUBLIC, anon;
REVOKE ALL ON public.show_tips_browse FROM PUBLIC, anon;
REVOKE ALL ON public.studios_browse FROM PUBLIC, anon;
REVOKE ALL ON public.studio_posts_browse FROM PUBLIC, anon;
REVOKE ALL ON public.studio_comments_browse FROM PUBLIC, anon;

GRANT SELECT ON public.show_teammates_browse TO authenticated;
GRANT SELECT ON public.show_tips_browse TO authenticated;
GRANT SELECT ON public.studios_browse TO authenticated;
GRANT SELECT ON public.studio_posts_browse TO authenticated;
GRANT SELECT ON public.studio_comments_browse TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

GRANT SELECT ON public.show_teammates_browse TO anon;
GRANT SELECT ON public.show_tips_browse TO anon;
GRANT SELECT ON public.studios_browse TO anon;
GRANT SELECT ON public.studio_posts_browse TO anon;
GRANT SELECT ON public.studio_comments_browse TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
