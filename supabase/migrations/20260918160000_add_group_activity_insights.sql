-- Aggregate-only department insights. The function exposes counts, not private
-- member activity rows, and is callable only by an active scoped group admin.

create or replace function public.get_group_activity_insights(_group_id uuid)
returns table (
  active_members bigint,
  pending_requests bigint,
  content_count bigint,
  accepted_invites bigint,
  pending_invites bigint,
  invite_acceptance_percent numeric,
  student_count bigint,
  alumni_count bigint,
  recent_activity_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_scoped_group_admin(auth.uid(), _group_id) then
    raise exception 'Only an active department admin can view department insights';
  end if;

  return query
  with
  active_users as (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = _group_id and gm.status = 'active'
  ),
  group_posts as (
    select pg.post_id from public.post_groups pg where pg.group_id = _group_id
  ),
  group_events as (
    select eg.event_id from public.event_groups eg where eg.group_id = _group_id
  ),
  group_projects as (
    select pg.project_id from public.project_groups pg where pg.group_id = _group_id
  ),
  group_project_roles as (
    select pr.id
    from public.project_roles pr
    join group_projects gp on gp.project_id = pr.project_id
  ),
  group_resource_ids as (
    select gr.id from public.group_resources gr where gr.group_id = _group_id
  ),
  membership_counts as (
    select
      count(*) filter (where gm.status = 'active')::bigint as active_members,
      count(*) filter (where gm.status = 'pending')::bigint as pending_requests
    from public.group_members gm
    where gm.group_id = _group_id
  ),
  content_counts as (
    select (
      (select count(*) from group_posts)
      + (select count(*) from group_events)
      + (select count(*) from group_projects)
    )::bigint as content_count
  ),
  invite_counts as (
    select
      count(*) filter (where gi.status = 'accepted')::bigint as accepted_invites,
      count(*) filter (where gi.status = 'pending')::bigint as pending_invites
    from public.group_invites gi
    where gi.group_id = _group_id
  ),
  student_counts as (
    select
      count(*) filter (where lower(coalesce(pp.graduation_status, '')) = 'student')::bigint as student_count,
      count(*) filter (where lower(coalesce(pp.graduation_status, '')) = 'alumni')::bigint as alumni_count
    from active_users au
    left join public.profiles_public pp on pp.user_id = au.user_id
  ),
  recent_activity as (
    select (
      (select count(*) from public.posts p join group_posts gp on gp.post_id = p.id
        where p.user_id in (select user_id from active_users) and p.created_at >= now() - interval '30 days')
      + (select count(*) from public.events e join group_events ge on ge.event_id = e.id
        where e.user_id in (select user_id from active_users) and e.created_at >= now() - interval '30 days')
      + (select count(*) from public.projects p join group_projects gp on gp.project_id = p.id
        where p.creator_id in (select user_id from active_users) and p.created_at >= now() - interval '30 days')
      + (select count(*) from public.post_comments pc join group_posts gp on gp.post_id = pc.post_id
        where pc.user_id in (select user_id from active_users) and pc.created_at >= now() - interval '30 days')
      + (select count(*) from public.saved_projects sp join group_projects gp on gp.project_id = sp.project_id
        where sp.user_id in (select user_id from active_users) and sp.saved_at >= now() - interval '30 days')
      + (select count(*) from public.role_applications ra join group_project_roles gpr on gpr.id = ra.project_role_id
        where ra.applicant_id in (select user_id from active_users) and ra.created_at >= now() - interval '30 days')
      + (select count(*) from public.opportunity_applications oa join group_posts gp on gp.post_id::text = oa.opportunity_id
        where oa.applicant_id in (select user_id from active_users) and oa.created_at >= now() - interval '30 days')
      + (select count(*) from public.saved_items si
        where si.user_id in (select user_id from active_users)
          and si.saved_at >= now() - interval '30 days'
          and (
            (si.item_type = 'job' and si.item_id in (select post_id::text from group_posts))
            or (si.item_type = 'resource' and si.item_id in (select id::text from group_resource_ids))
          ))
    )::bigint as recent_activity_count
  )
  select
    mc.active_members,
    mc.pending_requests,
    cc.content_count,
    ic.accepted_invites,
    ic.pending_invites,
    case
      when ic.accepted_invites + ic.pending_invites = 0 then 0
      else round(ic.accepted_invites * 100.0 / (ic.accepted_invites + ic.pending_invites), 1)
    end as invite_acceptance_percent,
    sc.student_count,
    sc.alumni_count,
    ra.recent_activity_count
  from membership_counts mc
  cross join content_counts cc
  cross join invite_counts ic
  cross join student_counts sc
  cross join recent_activity ra;
end
$$;

revoke all on function public.get_group_activity_insights(uuid) from public;
grant execute on function public.get_group_activity_insights(uuid) to authenticated;

notify pgrst, 'reload schema';
