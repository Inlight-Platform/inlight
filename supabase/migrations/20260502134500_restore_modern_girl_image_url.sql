-- Restore the original migrated image URL for "A Modern Girl"
-- after re-uploading the exact missing storage object.

update public.projects
set main_image_url = 'https://piofmmawwnermvaysonw.supabase.co/storage/v1/object/public/profile-media/d77aaee8-688b-4c17-9d8b-4958b4307998/posts/1771195466955-unbrsmo.jpg'
where id = '91872996-63eb-47eb-b8ee-2808f88e0a33'
  and title = '"A Modern Girl"';
