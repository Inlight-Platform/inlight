create or replace function public.notify_new_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name_val text;
  project_title_val text;
  project_id_val uuid;
begin
  select p.id, p.title, pr.role_name
  into project_id_val, project_title_val, role_name_val
  from public.project_roles pr
  join public.projects p on p.id = pr.project_id
  where pr.id = new.project_role_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.receiver_id,
    'invitation',
    'Project invitation',
    'You''ve been invited to join ' || coalesce(project_title_val, 'a project') || ' as ' || coalesce(role_name_val, 'a role'),
    jsonb_build_object(
      'invitation_id', new.id,
      'role_id', new.project_role_id,
      'project_id', project_id_val,
      'project_title', project_title_val,
      'role_name', role_name_val,
      'sender_id', new.sender_id
    )
  );

  return new;
end;
$$;
