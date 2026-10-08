BEGIN;

-- INV96 Group 7: industry catalog data requires authentication. Opportunities
-- remain anonymously readable only when they link to an external application.
ALTER TABLE public.streaming_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.film_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadway_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Streaming content is publicly viewable" ON public.streaming_content;
DROP POLICY IF EXISTS "Admins can insert streaming content" ON public.streaming_content;
DROP POLICY IF EXISTS "Admins can update streaming content" ON public.streaming_content;
DROP POLICY IF EXISTS "Admins can delete streaming content" ON public.streaming_content;

CREATE POLICY "Authenticated users can view streaming content"
ON public.streaming_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert streaming content"
ON public.streaming_content FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update streaming content"
ON public.streaming_content FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete streaming content"
ON public.streaming_content FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Film metrics are publicly readable" ON public.film_metrics;
DROP POLICY IF EXISTS "Admins can insert film metrics" ON public.film_metrics;
DROP POLICY IF EXISTS "Admins can update film metrics" ON public.film_metrics;
DROP POLICY IF EXISTS "Admins can delete film metrics" ON public.film_metrics;

CREATE POLICY "Authenticated users can view film metrics"
ON public.film_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert film metrics"
ON public.film_metrics FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update film metrics"
ON public.film_metrics FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete film metrics"
ON public.film_metrics FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Broadway metrics are publicly readable" ON public.broadway_metrics;
DROP POLICY IF EXISTS "Admins can insert broadway metrics" ON public.broadway_metrics;
DROP POLICY IF EXISTS "Admins can update broadway metrics" ON public.broadway_metrics;
DROP POLICY IF EXISTS "Admins can delete broadway metrics" ON public.broadway_metrics;

CREATE POLICY "Authenticated users can view broadway metrics"
ON public.broadway_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert broadway metrics"
ON public.broadway_metrics FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update broadway metrics"
ON public.broadway_metrics FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete broadway metrics"
ON public.broadway_metrics FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Industry highlights are publicly readable" ON public.industry_highlights;
DROP POLICY IF EXISTS "Admins can insert highlights" ON public.industry_highlights;
DROP POLICY IF EXISTS "Admins can update highlights" ON public.industry_highlights;
DROP POLICY IF EXISTS "Admins can delete highlights" ON public.industry_highlights;

CREATE POLICY "Authenticated users can view industry highlights"
ON public.industry_highlights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert highlights"
ON public.industry_highlights FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update highlights"
ON public.industry_highlights FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete highlights"
ON public.industry_highlights FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can view opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Public opportunities are viewable by visitors" ON public.opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update their own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can delete their own opportunities" ON public.opportunities;

CREATE POLICY "Admins can manage all opportunities"
ON public.opportunities FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Authenticated users can view opportunities"
ON public.opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "External opportunities are viewable by visitors"
ON public.opportunities FOR SELECT TO anon
USING (
  COALESCE(is_public, false)
  AND action_type = 'external'
  AND NULLIF(BTRIM(link_url), '') IS NOT NULL
);
CREATE POLICY "Users can create opportunities"
ON public.opportunities FOR INSERT TO authenticated
WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Users can update their own opportunities"
ON public.opportunities FOR UPDATE TO authenticated
USING (auth.uid() = posted_by)
WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Users can delete their own opportunities"
ON public.opportunities FOR DELETE TO authenticated
USING (auth.uid() = posted_by);

REVOKE ALL ON public.streaming_content FROM PUBLIC, anon;
REVOKE ALL ON public.film_metrics FROM PUBLIC, anon;
REVOKE ALL ON public.broadway_metrics FROM PUBLIC, anon;
REVOKE ALL ON public.industry_highlights FROM PUBLIC, anon;
REVOKE ALL ON public.opportunities FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.streaming_content TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.film_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadway_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.industry_highlights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT SELECT ON public.opportunities TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view streaming content" ON public.streaming_content;
DROP POLICY IF EXISTS "Admins can insert streaming content" ON public.streaming_content;
DROP POLICY IF EXISTS "Admins can update streaming content" ON public.streaming_content;
DROP POLICY IF EXISTS "Admins can delete streaming content" ON public.streaming_content;
CREATE POLICY "Streaming content is publicly viewable" ON public.streaming_content FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Admins can insert streaming content" ON public.streaming_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update streaming content" ON public.streaming_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete streaming content" ON public.streaming_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can view film metrics" ON public.film_metrics;
DROP POLICY IF EXISTS "Admins can insert film metrics" ON public.film_metrics;
DROP POLICY IF EXISTS "Admins can update film metrics" ON public.film_metrics;
DROP POLICY IF EXISTS "Admins can delete film metrics" ON public.film_metrics;
CREATE POLICY "Film metrics are publicly readable" ON public.film_metrics FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Admins can insert film metrics" ON public.film_metrics FOR INSERT TO PUBLIC WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update film metrics" ON public.film_metrics FOR UPDATE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete film metrics" ON public.film_metrics FOR DELETE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can view broadway metrics" ON public.broadway_metrics;
DROP POLICY IF EXISTS "Admins can insert broadway metrics" ON public.broadway_metrics;
DROP POLICY IF EXISTS "Admins can update broadway metrics" ON public.broadway_metrics;
DROP POLICY IF EXISTS "Admins can delete broadway metrics" ON public.broadway_metrics;
CREATE POLICY "Broadway metrics are publicly readable" ON public.broadway_metrics FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Admins can insert broadway metrics" ON public.broadway_metrics FOR INSERT TO PUBLIC WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update broadway metrics" ON public.broadway_metrics FOR UPDATE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete broadway metrics" ON public.broadway_metrics FOR DELETE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can view industry highlights" ON public.industry_highlights;
DROP POLICY IF EXISTS "Admins can insert highlights" ON public.industry_highlights;
DROP POLICY IF EXISTS "Admins can update highlights" ON public.industry_highlights;
DROP POLICY IF EXISTS "Admins can delete highlights" ON public.industry_highlights;
CREATE POLICY "Industry highlights are publicly readable" ON public.industry_highlights FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Admins can insert highlights" ON public.industry_highlights FOR INSERT TO PUBLIC WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update highlights" ON public.industry_highlights FOR UPDATE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete highlights" ON public.industry_highlights FOR DELETE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can view opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "External opportunities are viewable by visitors" ON public.opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update their own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can delete their own opportunities" ON public.opportunities;
CREATE POLICY "Admins can manage all opportunities" ON public.opportunities FOR ALL TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Authenticated users can view opportunities" ON public.opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public opportunities are viewable by visitors" ON public.opportunities FOR SELECT TO anon USING (COALESCE(is_public, false));
CREATE POLICY "Users can create opportunities" ON public.opportunities FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Users can update their own opportunities" ON public.opportunities FOR UPDATE TO PUBLIC USING (auth.uid() = posted_by);
CREATE POLICY "Users can delete their own opportunities" ON public.opportunities FOR DELETE TO PUBLIC USING (auth.uid() = posted_by);

GRANT SELECT ON public.streaming_content TO anon;
GRANT SELECT ON public.film_metrics TO anon;
GRANT SELECT ON public.broadway_metrics TO anon;
GRANT SELECT ON public.industry_highlights TO anon;
GRANT SELECT ON public.opportunities TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
