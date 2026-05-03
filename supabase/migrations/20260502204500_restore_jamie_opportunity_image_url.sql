-- Repoint the "Jamie" opportunity image to the restored original file
-- in the new Supabase storage bucket.

update public.opportunities
set image_url = 'https://piofmmawwnermvaysonw.supabase.co/storage/v1/object/public/profile-media/802c2c17-c03f-4f0a-9829-96edbecdcd54/posts/1776390594890-geq60bv.jpg'
where id = '25ea9100-4d83-43ad-ac4e-d5064faef401'
  and title = '"Jamie" in A Walk To Remember';
