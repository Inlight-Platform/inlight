-- Department resource drafts remain visible to scoped admins, while active
-- members can read only published resources.

alter table public.group_resources
  add column if not exists is_published boolean not null default true;

drop policy if exists "Group members can view resources" on public.group_resources;
drop policy if exists "Scoped admins and members can view resources" on public.group_resources;

create policy "Scoped admins and members can view resources"
on public.group_resources
for select
to authenticated
using (
  public.is_scoped_group_admin(auth.uid(), group_id)
  or (
    is_published
    and public.is_group_member(auth.uid(), group_id)
  )
);

create index if not exists group_resources_group_published_created_idx
  on public.group_resources(group_id, is_published, created_at desc);

notify pgrst, 'reload schema';
