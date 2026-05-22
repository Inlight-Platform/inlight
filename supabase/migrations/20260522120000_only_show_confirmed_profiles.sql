-- Only confirmed email users should create/show public profiles.
-- Supabase creates auth.users before email verification; these rows should not
-- count as real Inlight people until email_confirmed_at is set.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_display_name text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  safe_display_name := coalesce(
    trim(substring(new.raw_user_meta_data->>'display_name' from 1 for 100)),
    split_part(new.email, '@', 1)
  );

  if length(safe_display_name) = 0 then
    safe_display_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, safe_display_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_display_name text;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    safe_display_name := coalesce(
      trim(substring(new.raw_user_meta_data->>'display_name' from 1 for 100)),
      split_part(new.email, '@', 1)
    );

    if length(safe_display_name) = 0 then
      safe_display_name := split_part(new.email, '@', 1);
    end if;

    insert into public.profiles (user_id, email, display_name)
    values (new.id, new.email, safe_display_name)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  execute function public.handle_user_email_confirmed();

-- Remove profile rows created for users who still have not confirmed email.
delete from public.profiles p
using auth.users u
where p.user_id = u.id
  and u.email_confirmed_at is null;

drop view if exists public.profiles_public;

create view public.profiles_public as
select
  p.id,
  p.user_id,
  p.display_name,
  p.stage_name,
  p.avatar_url,
  p.cover_url,
  p.location,
  p.pronouns,
  p.role,
  p.badges,
  p.bio,
  p.headline,
  p.skills,
  p.instagram_url,
  p.website_url,
  p.graduation_status,
  p.graduation_year,
  p.favorite_artist,
  p.favorite_movie,
  p.favorite_song,
  p.why_artist,
  p.created_at,
  p.updated_at,
  p.activity_score,
  p.vouch_count,
  p.message_privacy,
  case when p.show_union_status then p.union_status else null end as union_status,
  case when p.show_representation then p.representation else null end as representation,
  case when p.show_gear_list then p.gear_list else null end as gear_list_display,
  p.show_union_status,
  p.show_representation,
  p.show_gear_list
from public.profiles p
join auth.users u on u.id = p.user_id
where u.email_confirmed_at is not null;

grant select on public.profiles_public to anon, authenticated;

create or replace function public.get_admin_user_count_summary()
returns table (
  profiles_total bigint,
  distinct_profile_users bigint,
  duplicate_profile_rows bigint,
  auth_users_total bigint
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  with confirmed_profiles as (
    select p.*
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where u.email_confirmed_at is not null
  )
  select
    (select count(*) from confirmed_profiles)::bigint as profiles_total,
    (select count(distinct user_id) from confirmed_profiles)::bigint as distinct_profile_users,
    (
      (select count(*) from confirmed_profiles)
      - (select count(distinct user_id) from confirmed_profiles)
    )::bigint as duplicate_profile_rows,
    (select count(*) from auth.users where email_confirmed_at is not null)::bigint as auth_users_total;
end;
$$;

grant execute on function public.get_admin_user_count_summary() to authenticated;

create or replace function public.get_admin_user_growth()
returns table (
  month date,
  new_users bigint,
  cumulative_users bigint
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  with confirmed_profiles as (
    select p.*
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where u.email_confirmed_at is not null
  ),
  bounds as (
    select
      date_trunc('month', min(p.created_at))::date as start_month,
      date_trunc('month', now())::date as end_month
    from confirmed_profiles p
  ),
  months as (
    select generate_series(start_month, end_month, interval '1 month')::date as month
    from bounds
    where start_month is not null
  ),
  monthly as (
    select
      date_trunc('month', p.created_at)::date as month,
      count(distinct p.user_id) as new_users
    from confirmed_profiles p
    group by 1
  )
  select
    m.month,
    coalesce(monthly.new_users, 0)::bigint as new_users,
    sum(coalesce(monthly.new_users, 0)) over (order by m.month)::bigint as cumulative_users
  from months m
  left join monthly using (month)
  order by m.month;
end;
$$;

grant execute on function public.get_admin_user_growth() to authenticated;
