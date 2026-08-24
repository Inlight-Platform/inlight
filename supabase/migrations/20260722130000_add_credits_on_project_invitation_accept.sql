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

-- Preserve project redirects when a valid project-credit invite link is retried
-- after the credit has already been claimed by the same invited account.
create or replace function public.accept_project_credit_invite(_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  invite_row public.project_credit_invites%rowtype;
  project_row public.projects%rowtype;
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  credit_id uuid;
  sender_credit_id uuid;
  sender_role text;
  credit_year integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into invite_row
    from public.project_credit_invites
   where token = btrim(coalesce(_token, ''))
   limit 1;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;

  if lower(invite_row.email) <> user_email then
    raise exception 'This invite belongs to a different email address';
  end if;

  if invite_row.status = 'accepted' then
    if invite_row.accepted_by is null or invite_row.accepted_by = auth.uid() then
      return jsonb_build_object(
        'claimed', true,
        'already_claimed', true,
        'project_id', invite_row.project_id
      );
    end if;

    raise exception 'This invite has already been claimed by another account';
  end if;

  if invite_row.status <> 'pending' then
    return jsonb_build_object('claimed', false, 'reason', invite_row.status);
  end if;

  select *
    into project_row
    from public.projects
   where id = invite_row.project_id;

  credit_year := extract(year from coalesce(project_row.start_date::timestamptz, project_row.created_at, now()))::integer;

  update public.credits
     set verified = true,
         updated_at = now()
   where user_id = auth.uid()
     and lower(project) = lower(project_row.title)
     and lower(role) = lower(invite_row.role_name)
   returning id into credit_id;

  if credit_id is null then
    insert into public.credits (user_id, project, role, year, verified)
    values (
      auth.uid(),
      project_row.title,
      invite_row.role_name,
      credit_year,
      true
    )
    returning id into credit_id;
  end if;

  insert into public.project_members (project_id, user_id, role)
  select invite_row.project_id, auth.uid(), invite_row.role_name
  where not exists (
    select 1
    from public.project_members pm
    where pm.project_id = invite_row.project_id
      and pm.user_id = auth.uid()
  );

  sender_role := case
    when project_row.creator_id = invite_row.inviter_id then 'Project Creator'
    else null
  end;

  if sender_role is null then
    select nullif(btrim(pm.role), '')
      into sender_role
      from public.project_members pm
     where pm.project_id = invite_row.project_id
       and pm.user_id = invite_row.inviter_id
     limit 1;
  end if;

  sender_role := coalesce(sender_role, 'Collaborator');

  update public.credits
     set role = sender_role,
         verified = true,
         updated_at = now()
   where user_id = invite_row.inviter_id
     and lower(project) = lower(project_row.title)
   returning id into sender_credit_id;

  if sender_credit_id is null then
    insert into public.credits (user_id, project, role, year, verified)
    values (
      invite_row.inviter_id,
      project_row.title,
      sender_role,
      credit_year,
      true
    )
    returning id into sender_credit_id;
  end if;

  update public.project_credit_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = auth.uid(),
         updated_at = now()
   where id = invite_row.id;

  return jsonb_build_object(
    'claimed', true,
    'credit_id', credit_id,
    'sender_credit_id', sender_credit_id,
    'project_id', invite_row.project_id
  );
end;
$function$;

grant execute on function public.accept_project_credit_invite(text) to authenticated;

with accepted_project_invites as (
  select
    pi.sender_id,
    pi.receiver_id,
    pr.project_id,
    pr.role_name,
    p.title as project_title,
    extract(year from coalesce(p.start_date::timestamptz, p.created_at, now()))::integer as credit_year,
    case
      when p.creator_id = pi.sender_id then 'Project Creator'
      else coalesce(nullif(btrim(pm.role), ''), 'Collaborator')
    end as sender_role
  from public.project_invitations pi
  join public.project_roles pr
    on pr.id = pi.project_role_id
  join public.projects p
    on p.id = pr.project_id
  left join public.project_members pm
    on pm.project_id = pr.project_id
   and pm.user_id = pi.sender_id
  where pi.status = 'accepted'
),
updated_invitee_credits as (
  update public.credits c
     set verified = true,
         updated_at = now()
    from accepted_project_invites api
   where c.user_id = api.receiver_id
     and lower(c.project) = lower(api.project_title)
     and lower(c.role) = lower(api.role_name)
  returning c.user_id, lower(c.project) as project_key, lower(c.role) as role_key
),
inserted_invitee_credits as (
  insert into public.credits (user_id, project, role, year, verified)
  select distinct on (api.receiver_id, lower(api.project_title), lower(api.role_name))
         api.receiver_id, api.project_title, api.role_name, api.credit_year, true
    from accepted_project_invites api
   where not exists (
     select 1
       from updated_invitee_credits uic
      where uic.user_id = api.receiver_id
        and uic.project_key = lower(api.project_title)
        and uic.role_key = lower(api.role_name)
   )
     and not exists (
       select 1
         from public.credits c
       where c.user_id = api.receiver_id
          and lower(c.project) = lower(api.project_title)
          and lower(c.role) = lower(api.role_name)
     )
   order by api.receiver_id, lower(api.project_title), lower(api.role_name)
  returning id
),
updated_sender_credits as (
  update public.credits c
     set role = api.sender_role,
         verified = true,
         updated_at = now()
    from accepted_project_invites api
   where c.user_id = api.sender_id
     and lower(c.project) = lower(api.project_title)
  returning c.user_id, lower(c.project) as project_key
)
insert into public.credits (user_id, project, role, year, verified)
select distinct on (api.sender_id, lower(api.project_title))
       api.sender_id, api.project_title, api.sender_role, api.credit_year, true
  from accepted_project_invites api
 where not exists (
   select 1
     from updated_sender_credits usc
    where usc.user_id = api.sender_id
      and usc.project_key = lower(api.project_title)
 )
   and not exists (
     select 1
       from public.credits c
      where c.user_id = api.sender_id
        and lower(c.project) = lower(api.project_title)
   )
 order by api.sender_id, lower(api.project_title);
