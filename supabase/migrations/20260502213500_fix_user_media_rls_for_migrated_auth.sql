-- Some accounts can authenticate successfully after migration but still fail
-- the strict auth.uid() = user_id user_media policy in the hosted app.
-- Allow the same owner through a profiles.email fallback tied to the JWT email.

drop policy if exists "Users can view their own media" on public.user_media;
drop policy if exists "Users can insert their own media" on public.user_media;
drop policy if exists "Users can update their own media" on public.user_media;
drop policy if exists "Users can delete their own media" on public.user_media;

create policy "Users can view their own media"
on public.user_media
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = user_media.user_id
      and lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

create policy "Users can insert their own media"
on public.user_media
for insert
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = user_media.user_id
      and lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

create policy "Users can update their own media"
on public.user_media
for update
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = user_media.user_id
      and lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

create policy "Users can delete their own media"
on public.user_media
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = user_media.user_id
      and lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);
