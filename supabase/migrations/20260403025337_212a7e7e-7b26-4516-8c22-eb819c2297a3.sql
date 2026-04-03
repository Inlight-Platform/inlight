INSERT INTO public.showcase_programs (name, slug, description, is_active)
VALUES ('Lee Strasberg Theatre & Film Institute', 'strasberg2026', 'Class of 2026', true)
ON CONFLICT (slug) DO NOTHING;