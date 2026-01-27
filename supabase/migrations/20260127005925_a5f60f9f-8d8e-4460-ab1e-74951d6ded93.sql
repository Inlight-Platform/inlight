
-- Add badge_tag column to studios for mapping to user badges
ALTER TABLE public.studios ADD COLUMN badge_tag TEXT;

-- Update existing studios with their badge tags
UPDATE public.studios SET badge_tag = 'etw' WHERE name = 'Experimental Theatre Wing';
UPDATE public.studios SET badge_tag = 'nsb' WHERE name = 'New Studio on Broadway';
UPDATE public.studios SET badge_tag = 'atlantic' WHERE name = 'Atlantic Theater Company';
UPDATE public.studios SET badge_tag = 'classical' WHERE name = 'Classical Studio';
UPDATE public.studios SET badge_tag = 'stonestreet' WHERE name = 'Stonestreet Studios';
UPDATE public.studios SET badge_tag = 'gradacting' WHERE name = 'Graduate Acting';
UPDATE public.studios SET badge_tag = 'playwrights' WHERE name = 'Playwrights Horizons';
UPDATE public.studios SET badge_tag = 'adler' WHERE name = 'Stella Adler';
UPDATE public.studios SET badge_tag = 'meisner' WHERE name = 'Meisner';
UPDATE public.studios SET badge_tag = 'innovation' WHERE name = 'The Innovation Studio';
UPDATE public.studios SET badge_tag = 'strasberg' WHERE name = 'Strasberg';
UPDATE public.studios SET badge_tag = 'UGFTV' WHERE name = 'Film and TV';
