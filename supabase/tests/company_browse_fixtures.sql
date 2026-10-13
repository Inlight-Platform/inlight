SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('dc000000-0000-4000-8000-000000000001', 'company-owner@example.test'),
 ('dc000000-0000-4000-8000-000000000002', 'company-other@example.test');
INSERT INTO public.companies(id, name, description, owner_user_id) VALUES
 ('dd000000-0000-4000-8000-000000000001', 'Company sentinel', 'Public description', 'dc000000-0000-4000-8000-000000000001'),
 ('dd000000-0000-4000-8000-000000000002', 'Unowned company', 'Public description', NULL);
SET LOCAL session_replication_role = origin;
