-- Mirror post/event audience targeting for projects.

alter table public.projects
  add column if not exists visibility text not null default 'public';

alter table public.projects
  drop constraint if exists projects_visibility_check;

alter table public.projects
  add constraint projects_visibility_check
  check (visibility in ('public', 'network', 'specific', 'group'));

update public.projects
set visibility = case when coalesce(is_public, false) then 'public' else 'specific' end
where visibility is null;

create table if not exists public.project_recipients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint unique_project_recipient unique (project_id, recipient_id)
);

grant select, insert, delete on public.project_recipients to authenticated;
grant all on public.project_recipients to service_role;

alter table public.project_recipients enable row level security;

drop policy if exists "Project owner can insert recipients" on public.project_recipients;
create policy "Project owner can insert recipients"
on public.project_recipients for insert
with check (
  auth.uid() in (select creator_id from public.projects where id = project_id)
);

drop policy if exists "Project owner can delete recipients" on public.project_recipients;
create policy "Project owner can delete recipients"
on public.project_recipients for delete
using (
  auth.uid() in (select creator_id from public.projects where id = project_id)
);

drop policy if exists "Project owner and recipients can view" on public.project_recipients;
create policy "Project owner and recipients can view"
on public.project_recipients for select
using (
  auth.uid() = recipient_id
  or auth.uid() in (select creator_id from public.projects where id = project_id)
);

create or replace function public.can_access_project(target_project_id uuid)
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
        p.visibility = 'public'
        or coalesce(p.is_public, false)
        or p.creator_id = auth.uid()
        or public.has_role(auth.uid(), 'admin'::public.app_role)
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
        or public.is_invited_to_project(p.id)
        or (
          p.visibility = 'network'
          and exists (
            select 1
            from public.connections c1
            inner join public.connections c2
              on c1.follower_id = c2.following_id
              and c1.following_id = c2.follower_id
            where c1.follower_id = p.creator_id
              and c1.following_id = auth.uid()
          )
        )
        or (
          p.visibility = 'specific'
          and exists (
            select 1
            from public.project_recipients pr
            where pr.project_id = p.id
              and pr.recipient_id = auth.uid()
          )
        )
        or (
          p.visibility = 'group'
          and exists (
            select 1
            from public.project_groups pg
            where pg.project_id = p.id
              and (
                public.is_group_member(auth.uid(), pg.group_id)
                or public.is_group_faculty(auth.uid(), pg.group_id)
              )
          )
        )
      )
  );
$$;

grant execute on function public.can_access_project(uuid) to anon, authenticated;

drop policy if exists "Public projects are viewable by visitors" on public.projects;
create policy "Public projects are viewable by visitors"
on public.projects
for select
to anon
using (visibility = 'public' or coalesce(is_public, false));

drop policy if exists "Authenticated users can view projects" on public.projects;
drop policy if exists "Users can view accessible projects" on public.projects;
drop policy if exists "Project members can view their projects" on public.projects;
drop policy if exists "Admins can view all projects" on public.projects;

create policy "Users can view accessible projects"
on public.projects
for select
to authenticated
using (public.can_access_project(projects.id));

create index if not exists idx_projects_visibility
  on public.projects(visibility);

create index if not exists idx_project_recipients_project_id
  on public.project_recipients(project_id);

create index if not exists idx_project_recipients_recipient_id
  on public.project_recipients(recipient_id);

notify pgrst, 'reload schema';
