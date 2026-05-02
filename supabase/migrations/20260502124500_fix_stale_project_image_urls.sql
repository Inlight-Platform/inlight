-- Repair stale project image URLs after storage migration.
-- Some rows still pointed at legacy post-style paths that no longer exist
-- in the new Supabase storage bucket.

update public.projects
set main_image_url = 'https://piofmmawwnermvaysonw.supabase.co/storage/v1/object/public/profile-media/projects/283b4c02-03d1-489c-8207-0d26ed1d693d/1771365892512-lkkyxu2.jpeg'
where id = '283b4c02-03d1-489c-8207-0d26ed1d693d'
  and title = 'RAGE';

-- No matching migrated storage object currently exists for this project,
-- so clear the stale URL to avoid broken image requests until the file is recovered.
update public.projects
set main_image_url = null
where id = '91872996-63eb-47eb-b8ee-2808f88e0a33'
  and title = '"A Modern Girl"';
