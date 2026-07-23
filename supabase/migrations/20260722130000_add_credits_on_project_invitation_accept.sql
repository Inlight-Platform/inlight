-- When a project_invitation is accepted, upsert verified credits for both
-- the invitee (with the invited role) and the sender (with their project role).
create or replace function public.accept_project_invitation(_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_row public.project_invitations%rowtype;
  role_row       public.project_roles%rowtype;
  project_row    public.projects%rowtype;
  credit_year    integer;
  credit_id      uuid;
  sender_credit_id uuid;
  sender_role    text;
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

  select * into role_row
    from public.project_roles
   where id = invitation_row.project_role_id;

  if not found then
    raise exception 'Project role not found';
  end if;

  select * into project_row
    from public.projects
   where id = role_row.project_id;

  credit_year := extract(year from coalesce(
    project_row.start_date::timestamptz,
    project_row.created_at,
    now()
  ))::integer;

  -- Accept the invitation and assign the role
  update public.project_invitations
     set status = 'accepted', updated_at = now()
   where id = invitation_row.id;

  update public.project_roles
     set assigned_user_id = auth.uid(), updated_at = now()
   where id = role_row.id;

  insert into public.project_members (project_id, user_id, role)
  values (role_row.project_id, auth.uid(), role_row.role_name)
  on conflict (project_id, user_id) do update
    set role = excluded.role;

  -- Upsert a verified credit for the invitee
  update public.credits
     set verified = true, updated_at = now()
   where user_id = auth.uid()
     and lower(project) = lower(project_row.title)
     and lower(role)    = lower(role_row.role_name)
   returning id into credit_id;

  if credit_id is null then
    insert into public.credits (user_id, project, role, year, verified)
    values (auth.uid(), project_row.title, role_row.role_name, credit_year, true)
    returning id into credit_id;
  end if;

  -- Determine the sender's role on the project
  sender_role := case
    when project_row.creator_id = invitation_row.sender_id then 'Project Creator'
    else null
  end;

  if sender_role is null then
    select nullif(btrim(pm.role), '')
      into sender_role
      from public.project_members pm
     where pm.project_id = role_row.project_id
       and pm.user_id    = invitation_row.sender_id
     limit 1;
  end if;

  sender_role := coalesce(sender_role, 'Collaborator');

  -- Upsert a verified credit for the sender
  update public.credits
     set role = sender_role, verified = true, updated_at = now()
   where user_id = invitation_row.sender_id
     and lower(project) = lower(project_row.title)
   returning id into sender_credit_id;

  if sender_credit_id is null then
    insert into public.credits (user_id, project, role, year, verified)
    values (invitation_row.sender_id, project_row.title, sender_role, credit_year, true)
    returning id into sender_credit_id;
  end if;

  return jsonb_build_object(
    'project_id',       role_row.project_id,
    'role_id',          role_row.id,
    'role_name',        role_row.role_name,
    'credit_id',        credit_id,
    'sender_credit_id', sender_credit_id
  );
end;
$$;

grant execute on function public.accept_project_invitation(uuid) to authenticated;
