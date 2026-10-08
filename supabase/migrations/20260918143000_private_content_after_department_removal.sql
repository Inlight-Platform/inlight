-- Department removal retains the parent item, resets it to creator-only, and
-- notifies the creator with a direct path for choosing a new audience.

alter table public.events drop constraint if exists events_visibility_check;
alter table public.events add constraint events_visibility_check
  check (visibility in ('public', 'network', 'specific', 'group', 'private', 'unlisted'));

alter table public.projects drop constraint if exists projects_visibility_check;
alter table public.projects add constraint projects_visibility_check
  check (visibility in ('public', 'network', 'specific', 'group', 'private'));

create or replace function public.can_view_event(event_row public.events)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when event_row.visibility in ('public', 'unlisted') then true
    when event_row.user_id = auth.uid() then true
    when public.has_role(auth.uid(), 'admin') then true
    when event_row.visibility = 'network' then exists (
      select 1 from public.connections c1
      inner join public.connections c2
        on c1.follower_id = c2.following_id and c1.following_id = c2.follower_id
      where c1.follower_id = event_row.user_id and c1.following_id = auth.uid()
    )
    when event_row.visibility = 'specific' then exists (
      select 1 from public.event_recipients er
      where er.event_id = event_row.id and er.recipient_id = auth.uid()
    )
    when event_row.visibility = 'group' then exists (
      select 1 from public.event_groups eg
      where eg.event_id = event_row.id
        and (public.is_group_member(auth.uid(), eg.group_id)
          or public.is_group_faculty(auth.uid(), eg.group_id))
    )
    else false
  end
$$;

create or replace function public.remove_group_content(
  target_group_id uuid, target_content_type text, target_content_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  content_owner uuid;
  content_title text;
  content_path text;
begin
  if not public.is_scoped_group_admin(auth.uid(), target_group_id) then
    raise exception 'Only an active department admin can remove department content';
  end if;

  if target_content_type = 'event' then
    select user_id, title into content_owner, content_title
    from public.events where id = target_content_id;
    if content_owner is null then raise exception 'Event not found'; end if;
    delete from public.event_groups
      where group_id = target_group_id and event_id = target_content_id;
    if not found then raise exception 'Event is not linked to this department'; end if;
    delete from public.event_recipients where event_id = target_content_id;
    update public.events set visibility = 'private' where id = target_content_id;
    content_path := '/events/' || target_content_id::text;
  elsif target_content_type = 'project' then
    select creator_id, title into content_owner, content_title
    from public.projects where id = target_content_id;
    if content_owner is null then raise exception 'Project not found'; end if;
    delete from public.project_groups
      where group_id = target_group_id and project_id = target_content_id;
    if not found then raise exception 'Project is not linked to this department'; end if;
    delete from public.project_recipients where project_id = target_content_id;
    update public.projects set visibility = 'private', is_public = false
      where id = target_content_id;
    content_path := '/projects/' || target_content_id::text;
  else
    raise exception 'Unsupported content type';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    content_owner,
    'department_content_removed',
    initcap(target_content_type) || ' removed from department',
    coalesce(content_title, 'Your ' || target_content_type) ||
      ' is now private and visible only to you. Open it to choose a new audience.',
    jsonb_build_object('content_type', target_content_type, 'content_id', target_content_id, 'path', content_path)
  );
end
$$;

grant execute on function public.remove_group_content(uuid, text, uuid) to authenticated;
notify pgrst, 'reload schema';
