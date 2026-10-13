SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('de000000-0000-4000-8000-000000000001', 'attribution-owner@example.test'),
 ('de000000-0000-4000-8000-000000000002', 'attribution-other@example.test'),
 ('de000000-0000-4000-8000-000000000003', 'attribution-admin@example.test');
INSERT INTO public.user_roles(user_id, role) VALUES
 ('de000000-0000-4000-8000-000000000003', 'admin');
INSERT INTO public.nyc_shows(id, title, venue, category, submitted_by) VALUES
 ('df000000-0000-4000-8000-000000000001', 'Attribution show', 'Test venue', 'school', 'de000000-0000-4000-8000-000000000001');
INSERT INTO public.studios(id, name, badge_tag) VALUES
 ('df000000-0000-4000-8000-000000000001', 'Attribution studio', 'test');
INSERT INTO public.show_teammates(id, show_id, user_id, role_description) VALUES
 ('df000000-0000-4000-8000-000000000001', 'df000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Performer');
INSERT INTO public.show_tips(id, show_id, user_id, content) VALUES
 ('df000000-0000-4000-8000-000000000001', 'df000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Tip sentinel');
INSERT INTO public.studio_posts(id, studio_id, user_id, content) VALUES
 ('df000000-0000-4000-8000-000000000001', 'df000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Post sentinel');
INSERT INTO public.studio_comments(id, post_id, user_id, content) VALUES
 ('df000000-0000-4000-8000-000000000001', 'df000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'Comment sentinel');
SET LOCAL session_replication_role = origin;
