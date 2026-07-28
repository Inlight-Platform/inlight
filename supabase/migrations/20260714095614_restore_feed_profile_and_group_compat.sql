-- Repair production feed compatibility after RPC privilege tightening and
-- partial schema drift.
--
-- The published app expects these group RPCs, but the linked production
-- database does not currently have the groups tables. Return empty results so
-- the feed can continue to load until migration history is reconciled.

create or replace function public.get_my_groups()
returns table(id uuid, slug text, name text, is_faculty boolean)
language sql
stable
security definer
set search_path = public
as $$
  select null::uuid, null::text, null::text, null::boolean
  where false
$$;

revoke all on function public.get_my_groups() from public;
grant execute on function public.get_my_groups() to authenticated;

create or replace function public.get_my_faculty_group()
returns table(id uuid, slug text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select null::uuid, null::text, null::text
  where false
$$;

revoke all on function public.get_my_faculty_group() from public;
grant execute on function public.get_my_faculty_group() to authenticated;

-- profiles_public must not run as security_invoker because browser roles do
-- not and should not have direct select access to public.profiles.
create or replace view public.profiles_public
with (security_invoker = false)
as
select
  id,
  user_id,
  display_name,
  stage_name,
  avatar_url,
  cover_url,
  location,
  role,
  badges,
  bio,
  headline,
  skills,
  instagram_url,
  website_url,
  graduation_status,
  graduation_year,
  created_at,
  updated_at,
  activity_score,
  vouch_count,
  favorite_movie,
  favorite_artist,
  favorite_song,
  why_artist,
  watchlist_public,
  case
    when show_union_status then union_status
    else null::text
  end as union_status,
  case
    when show_representation then representation
    else null::text
  end as representation,
  case
    when show_gear_list then gear_list
    else null::text[]
  end as gear_list_display,
  show_union_status,
  show_representation,
  show_gear_list
from public.profiles
where public.profile_is_visible_to_current_user(user_id);

grant select on public.profiles_public to anon, authenticated;

notify pgrst, 'reload schema';
