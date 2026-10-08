create table if not exists public.group_resources (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text not null default '',
  url text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_resources_group_created_idx
  on public.group_resources(group_id, created_at desc);

alter table public.group_resources enable row level security;

drop policy if exists "Group members can view resources" on public.group_resources;
create policy "Group members can view resources"
on public.group_resources for select
using (
  public.is_group_member(auth.uid(), group_id)
  or public.is_scoped_group_admin(auth.uid(), group_id)
);

drop policy if exists "Scoped group admins can create resources" on public.group_resources;
create policy "Scoped group admins can create resources"
on public.group_resources for insert
with check (
  created_by = auth.uid()
  and public.is_scoped_group_admin(auth.uid(), group_id)
);

drop policy if exists "Scoped group admins can update resources" on public.group_resources;
create policy "Scoped group admins can update resources"
on public.group_resources for update
using (public.is_scoped_group_admin(auth.uid(), group_id))
with check (public.is_scoped_group_admin(auth.uid(), group_id));

drop policy if exists "Scoped group admins can delete resources" on public.group_resources;
create policy "Scoped group admins can delete resources"
on public.group_resources for delete
using (public.is_scoped_group_admin(auth.uid(), group_id));

grant select, insert, update, delete on public.group_resources to authenticated;
grant all on public.group_resources to service_role;

drop trigger if exists set_group_resources_updated_at on public.group_resources;
create trigger set_group_resources_updated_at
  before update on public.group_resources
  for each row
  execute function public.update_updated_at_column();

notify pgrst, 'reload schema';
