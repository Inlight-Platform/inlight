-- Keep private profile fields locked down, but restore the intentionally public
-- profile directory surface so public-safe cards can render again.

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
