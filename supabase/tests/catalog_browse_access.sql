-- Runner encloses setup, migration and tests in a rollback-only transaction.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('da000000-0000-4000-8000-000000000001', 'catalog-owner@example.test'),
 ('da000000-0000-4000-8000-000000000002', 'catalog-other@example.test');
INSERT INTO public.user_films(id,title,link_url,submitted_by,is_anonymous,is_active) VALUES
 ('db000000-0000-4000-8000-000000000001','Active sentinel','https://example.test/film','da000000-0000-4000-8000-000000000001',true,true),
 ('db000000-0000-4000-8000-000000000002','Inactive sentinel','https://example.test/film','da000000-0000-4000-8000-000000000001',true,false);
INSERT INTO public.user_music_shows(id,title,submitted_by,is_anonymous,is_active) VALUES
 ('db000000-0000-4000-8000-000000000001','Active sentinel','da000000-0000-4000-8000-000000000001',true,true),
 ('db000000-0000-4000-8000-000000000002','Inactive sentinel','da000000-0000-4000-8000-000000000001',true,false);
INSERT INTO public.nyc_shows(id,title,venue,category,submitted_by,is_anonymous,is_active) VALUES
 ('db000000-0000-4000-8000-000000000001','Active sentinel','Test venue','school','da000000-0000-4000-8000-000000000001',true,true),
 ('db000000-0000-4000-8000-000000000002','Inactive sentinel','Test venue','school','da000000-0000-4000-8000-000000000001',true,false);
SET LOCAL session_replication_role = origin;
-- Fixtures are inserted before installing projection triggers/backfill.
