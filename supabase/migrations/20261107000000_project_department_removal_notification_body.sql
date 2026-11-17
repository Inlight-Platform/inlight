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
      case when target_content_type = 'project' then
        ' was removed from the department feed. You, project members, and invitees keep access. Open it to review its audience.'
      else
        ' is now private and visible only to you. Open it to choose a new audience.'
      end,
    jsonb_build_object('content_type', target_content_type, 'content_id', target_content_id, 'path', content_path)
  );
end
$$;
