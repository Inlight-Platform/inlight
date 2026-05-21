-- Admin product insights backed by first-party Supabase data.
-- User counts intentionally use public.profiles because that is the source
-- rendered by the People page.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('page_view', 'page_duration', 'showcase_site_view', 'showcase_profile_view')),
  path text not null,
  site_slug text,
  visitor_id text,
  user_id uuid references auth.users(id) on delete set null,
  referrer text,
  user_agent text,
  duration_ms integer check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 86400000)),
  occurred_at timestamptz not null default now()
);

alter table public.analytics_events
  add column if not exists duration_ms integer;

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in ('page_view', 'page_duration', 'showcase_site_view', 'showcase_profile_view'));

alter table public.analytics_events
  drop constraint if exists analytics_events_duration_ms_check;

alter table public.analytics_events
  add constraint analytics_events_duration_ms_check
  check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 86400000));

alter table public.analytics_events enable row level security;

grant insert on public.analytics_events to service_role;

drop policy if exists "Admins can view analytics events" on public.analytics_events;
create policy "Admins can view analytics events"
on public.analytics_events
for select
using (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists idx_analytics_events_name_time
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists idx_analytics_events_site_time
  on public.analytics_events (site_slug, occurred_at desc)
  where site_slug is not null;

create index if not exists idx_analytics_events_visitor
  on public.analytics_events (visitor_id)
  where visitor_id is not null;

create or replace function public.get_admin_user_growth()
returns table (
  month date,
  new_users bigint,
  cumulative_users bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  with bounds as (
    select
      date_trunc('month', min(p.created_at))::date as start_month,
      date_trunc('month', now())::date as end_month
    from public.profiles p
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
    from public.profiles p
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

create or replace function public.get_admin_profile_duplicate_report()
returns table (
  user_id uuid,
  profile_count bigint,
  profile_ids uuid[],
  emails text[],
  first_created_at timestamptz,
  last_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  select
    p.user_id,
    count(*)::bigint as profile_count,
    array_agg(p.id order by p.created_at) as profile_ids,
    array_agg(distinct p.email) filter (where p.email is not null) as emails,
    min(p.created_at) as first_created_at,
    max(p.created_at) as last_created_at
  from public.profiles p
  group by p.user_id
  having count(*) > 1
  order by count(*) desc, max(p.created_at) desc;
end;
$$;

grant execute on function public.get_admin_profile_duplicate_report() to authenticated;

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
  select
    (select count(*) from public.profiles)::bigint as profiles_total,
    (select count(distinct user_id) from public.profiles)::bigint as distinct_profile_users,
    (
      (select count(*) from public.profiles)
      - (select count(distinct user_id) from public.profiles)
    )::bigint as duplicate_profile_rows,
    (select count(*) from auth.users)::bigint as auth_users_total;
end;
$$;

grant execute on function public.get_admin_user_count_summary() to authenticated;

create or replace function public.get_admin_showcase_site_metrics(days_back integer default 90)
returns table (
  site_slug text,
  site_name text,
  active_profiles bigint,
  visits bigint,
  unique_visitors bigint,
  last_visited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  with profile_counts as (
    select sp.program_slug, count(*)::bigint as active_profiles
    from public.showcase_profiles sp
    where sp.is_active = true
    group by sp.program_slug
  ),
  visit_counts as (
    select
      ae.site_slug,
      count(*)::bigint as visits,
      count(distinct coalesce(ae.visitor_id, ae.user_id::text))::bigint as unique_visitors,
      max(ae.occurred_at) as last_visited_at
    from public.analytics_events ae
    where ae.event_name in ('showcase_site_view', 'showcase_profile_view')
      and ae.site_slug is not null
      and ae.occurred_at >= now() - make_interval(days => greatest(days_back, 1))
    group by ae.site_slug
  )
  select
    p.slug as site_slug,
    p.name as site_name,
    coalesce(pc.active_profiles, 0)::bigint as active_profiles,
    coalesce(vc.visits, 0)::bigint as visits,
    coalesce(vc.unique_visitors, 0)::bigint as unique_visitors,
    vc.last_visited_at
  from public.showcase_programs p
  left join profile_counts pc on pc.program_slug = p.slug
  left join visit_counts vc on vc.site_slug = p.slug
  where p.is_active = true
  order by coalesce(vc.visits, 0) desc, p.name asc;
end;
$$;

grant execute on function public.get_admin_showcase_site_metrics(integer) to authenticated;

drop function if exists public.get_admin_page_metrics(integer);

create or replace function public.get_admin_page_metrics(days_back integer default 90)
returns table (
  path text,
  visits bigint,
  unique_visitors bigint,
  average_duration_seconds numeric,
  total_duration_seconds numeric,
  last_visited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  with page_views as (
    select
      ae.path,
      count(*)::bigint as visits,
      count(distinct coalesce(ae.visitor_id, ae.user_id::text))::bigint as unique_visitors,
      max(ae.occurred_at) as last_visited_at
    from public.analytics_events ae
    where ae.event_name = 'page_view'
      and ae.occurred_at >= now() - make_interval(days => greatest(days_back, 1))
    group by ae.path
  ),
  durations as (
    select
      ae.path,
      round((avg(ae.duration_ms) / 1000.0)::numeric, 1) as average_duration_seconds,
      round((sum(ae.duration_ms) / 1000.0)::numeric, 1) as total_duration_seconds
    from public.analytics_events ae
    where ae.event_name = 'page_duration'
      and ae.duration_ms is not null
      and ae.occurred_at >= now() - make_interval(days => greatest(days_back, 1))
    group by ae.path
  )
  select
    pv.path,
    pv.visits,
    pv.unique_visitors,
    coalesce(d.average_duration_seconds, 0)::numeric as average_duration_seconds,
    coalesce(d.total_duration_seconds, 0)::numeric as total_duration_seconds,
    pv.last_visited_at
  from page_views pv
  left join durations d using (path)
  order by pv.visits desc, coalesce(d.total_duration_seconds, 0) desc, pv.last_visited_at desc
  limit 50;
end;
$$;

grant execute on function public.get_admin_page_metrics(integer) to authenticated;

create or replace function public.get_admin_analytics_summary(days_back integer default 90)
returns table (
  visitors bigint,
  pageviews bigint,
  views_per_visitor numeric,
  average_duration_seconds numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin privileges required';
  end if;

  return query
  with views as (
    select
      count(*)::bigint as pageviews,
      count(distinct coalesce(ae.visitor_id, ae.user_id::text))::bigint as visitors
    from public.analytics_events ae
    where ae.event_name = 'page_view'
      and ae.occurred_at >= now() - make_interval(days => greatest(days_back, 1))
  ),
  durations as (
    select round((avg(ae.duration_ms) / 1000.0)::numeric, 1) as average_duration_seconds
    from public.analytics_events ae
    where ae.event_name = 'page_duration'
      and ae.duration_ms is not null
      and ae.occurred_at >= now() - make_interval(days => greatest(days_back, 1))
  )
  select
    views.visitors,
    views.pageviews,
    case when views.visitors = 0 then 0 else round((views.pageviews::numeric / views.visitors::numeric), 2) end as views_per_visitor,
    coalesce(durations.average_duration_seconds, 0)::numeric as average_duration_seconds
  from views, durations;
end;
$$;

grant execute on function public.get_admin_analytics_summary(integer) to authenticated;
