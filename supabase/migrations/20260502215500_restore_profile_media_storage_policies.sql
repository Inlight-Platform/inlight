-- Restore storage RLS policies for the public profile-media bucket.
-- These were present in the original project but are missing in the migrated project.

drop policy if exists "Users can upload their own media" on storage.objects;
drop policy if exists "Users can update their own media" on storage.objects;
drop policy if exists "Users can delete their own media" on storage.objects;
drop policy if exists "Public can view all profile media" on storage.objects;

create policy "Users can upload their own media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public can view all profile media"
on storage.objects
for select
to public
using (bucket_id = 'profile-media');
