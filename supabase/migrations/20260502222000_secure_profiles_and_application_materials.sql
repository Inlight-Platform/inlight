-- Tighten broad profile access and move future opportunity uploads
-- out of the public profile-media bucket.

drop view if exists public.profiles_public;
create view public.profiles_public
with (security_invoker=on) as
select
  id,
  user_id,
  display_name,
  stage_name,
  avatar_url,
  cover_url,
  location,
  pronouns,
  role,
  badges,
  bio,
  headline,
  skills,
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  favorite_artist,
  favorite_movie,
  favorite_song,
  why_artist,
  created_at,
  updated_at,
  activity_score,
  vouch_count,
  message_privacy,
  case when show_union_status then union_status else null end as union_status,
  case when show_representation then representation else null end as representation,
  case when show_gear_list then gear_list else null end as gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list
from public.profiles;

grant select on public.profiles_public to anon, authenticated;

create or replace function public.get_message_privacy(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(message_privacy, 'mutuals_only')
  from public.profiles
  where user_id = target_user_id
  limit 1
$$;

grant execute on function public.get_message_privacy(uuid) to authenticated;

drop policy if exists "Authenticated users can view other profiles" on public.profiles;

create or replace function public.add_project_member_by_email(
  target_project_id uuid,
  target_email text,
  target_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = target_project_id
      and creator_id = auth.uid()
  ) then
    raise exception 'Only the project creator can add members';
  end if;

  select user_id
  into resolved_user_id
  from public.profiles
  where lower(email) = lower(trim(target_email))
  limit 1;

  if resolved_user_id is null then
    raise exception 'User not found';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (target_project_id, resolved_user_id, nullif(trim(target_role), ''))
  on conflict (project_id, user_id) do update
  set role = excluded.role;
end;
$$;

grant execute on function public.add_project_member_by_email(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('application-materials', 'application-materials', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Applicants can upload their own application materials" on storage.objects;
drop policy if exists "Applicants can update their own application materials" on storage.objects;
drop policy if exists "Applicants can delete their own application materials" on storage.objects;

create policy "Applicants can upload their own application materials"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'application-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Applicants can update their own application materials"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'application-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'application-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Applicants can delete their own application materials"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'application-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);
