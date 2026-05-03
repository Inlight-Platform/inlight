
-- Restore profiles_public view with the columns the app expects (activity_score,
-- vouch_count, message_privacy) so PersonCard/Network/Profile pages stop receiving
-- SelectQueryError objects (which crashed `.id` access).
drop view if exists public.profiles_public;

create view public.profiles_public as
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

-- Recreate missing public-facing RPC wrappers that the client calls.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- get_message_privacy
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

-- get_public_event_rsvps
create or replace function public.get_public_event_rsvps(target_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  role_type text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.event_id, r.user_id, r.name, r.role_type, r.status, r.created_at
  from public.event_rsvps r
  where r.event_id = target_event_id
  order by r.created_at asc
$$;
grant execute on function public.get_public_event_rsvps(uuid) to anon, authenticated;

-- add_project_member_by_email
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
    select 1 from public.projects
    where id = target_project_id and creator_id = auth.uid()
  ) then
    raise exception 'Only the project creator can add members';
  end if;

  select user_id into resolved_user_id
  from public.profiles
  where lower(email) = lower(trim(target_email))
  limit 1;

  if resolved_user_id is null then
    raise exception 'User not found';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (target_project_id, resolved_user_id, nullif(trim(target_role), ''))
  on conflict (project_id, user_id) do update set role = excluded.role;
end;
$$;
grant execute on function public.add_project_member_by_email(uuid, text, text) to authenticated;
