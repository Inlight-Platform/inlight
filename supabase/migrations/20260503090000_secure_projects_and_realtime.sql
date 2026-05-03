-- Restrict private project visibility and authorize private Realtime topics.

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
        coalesce(p.is_public, false)
        or p.creator_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  )
$$;

grant execute on function public.can_access_project(uuid) to anon, authenticated;

drop policy if exists "Anyone can view projects" on public.projects;
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
);

drop policy if exists "Anyone can view project members" on public.project_members;
create policy "Users can view members for accessible projects"
on public.project_members
for select
using (public.can_access_project(project_id));

drop policy if exists "Anyone can view project photos" on public.project_photos;
create policy "Users can view photos for accessible projects"
on public.project_photos
for select
using (public.can_access_project(project_id));

drop policy if exists "Anyone can view project roles" on public.project_roles;
create policy "Users can view roles for accessible projects"
on public.project_roles
for select
using (public.can_access_project(project_id));

alter table realtime.messages enable row level security;

create policy "Authenticated users can subscribe to their own message channels"
on realtime.messages
for select
to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'messages'
  and split_part(realtime.topic(), ':', 2) = auth.uid()::text
);

create policy "Authenticated users can subscribe to their own notification channels"
on realtime.messages
for select
to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'notifications'
  and split_part(realtime.topic(), ':', 2) = auth.uid()::text
);

create policy "Authenticated users can subscribe to their own job credit channels"
on realtime.messages
for select
to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'job-credits'
  and split_part(realtime.topic(), ':', 2) = auth.uid()::text
);

create policy "Authenticated users can subscribe to their group chat channels"
on realtime.messages
for select
to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'group-chat'
  and exists (
    select 1
    from public.group_chat_members gcm
    where gcm.group_chat_id::text = split_part(realtime.topic(), ':', 2)
      and gcm.user_id = auth.uid()
  )
);
