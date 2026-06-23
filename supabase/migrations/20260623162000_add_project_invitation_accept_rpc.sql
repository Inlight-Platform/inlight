create or replace function public.accept_project_invitation(_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_row public.project_invitations%rowtype;
  role_row public.project_roles%rowtype;
begin
  select *
  into invitation_row
  from public.project_invitations
  where id = _invitation_id
    and receiver_id = auth.uid();

  if not found then
    raise exception 'Invitation not found';
  end if;

  if invitation_row.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;

  select *
  into role_row
  from public.project_roles
  where id = invitation_row.project_role_id;

  if not found then
    raise exception 'Project role not found';
  end if;

  update public.project_invitations
     set status = 'accepted',
         updated_at = now()
   where id = invitation_row.id;

  update public.project_roles
     set assigned_user_id = auth.uid(),
         updated_at = now()
   where id = role_row.id;

  insert into public.project_members (project_id, user_id, role)
  values (role_row.project_id, auth.uid(), role_row.role_name)
  on conflict (project_id, user_id) do update
  set role = excluded.role;

  return jsonb_build_object(
    'project_id', role_row.project_id,
    'role_id', role_row.id,
    'role_name', role_row.role_name
  );
end;
$$;

grant execute on function public.accept_project_invitation(uuid) to authenticated;
