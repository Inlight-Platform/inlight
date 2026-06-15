-- Keep project-credit invite sender credits distinct from invited collaborator roles.
-- The invited user receives the invited role; the project owner receives Project Creator.

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
     and status = 'pending'
   limit 1;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;

  if lower(invite_row.email) <> user_email then
    raise exception 'This invite belongs to a different email address';
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

with accepted_sender_roles as (
  select distinct on (pci.inviter_id, lower(p.title))
    pci.inviter_id,
    p.title as project_title,
    case
      when p.creator_id = pci.inviter_id then 'Project Creator'
      else coalesce(nullif(btrim(pm.role), ''), 'Collaborator')
    end as sender_role
  from public.project_credit_invites pci
  join public.projects p on p.id = pci.project_id
  left join public.project_members pm
    on pm.project_id = pci.project_id
   and pm.user_id = pci.inviter_id
  where pci.status = 'accepted'
  order by pci.inviter_id, lower(p.title), pci.accepted_at desc nulls last, pci.created_at desc
)
update public.credits c
   set role = a.sender_role,
       verified = true,
       updated_at = now()
  from accepted_sender_roles a
 where c.user_id = a.inviter_id
   and lower(c.project) = lower(a.project_title);

grant execute on function public.accept_project_credit_invite(text) to authenticated;
