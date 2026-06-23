create schema if not exists private;

create or replace function private.is_invited_to_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_invitations pi
    join public.project_roles pr on pr.id = pi.project_role_id
    where pr.project_id = target_project_id
      and pi.receiver_id = auth.uid()
      and pi.status in ('pending', 'accepted')
  )
$$;

grant execute on function private.is_invited_to_project(uuid) to authenticated;

create or replace function public.is_invited_to_project(target_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_invited_to_project(target_project_id)
$$;

grant execute on function public.is_invited_to_project(uuid) to authenticated;

create or replace function private.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and (
        coalesce(p.is_public, false)
        or p.creator_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
        or private.is_invited_to_project(p.id)
      )
  )
$$;

grant execute on function private.can_access_project(uuid) to authenticated;

create or replace function public.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.can_access_project(target_project_id)
$$;

grant execute on function public.can_access_project(uuid) to authenticated;

drop policy if exists "Users can view accessible projects" on public.projects;
create policy "Users can view accessible projects"
on public.projects
for select
using (
  coalesce(is_public, false)
  or creator_id = auth.uid()
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
  )
  or public.is_invited_to_project(projects.id)
);
