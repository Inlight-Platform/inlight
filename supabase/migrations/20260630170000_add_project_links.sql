create table if not exists public.project_links (
  id uuid not null default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  url text not null,
  created_at timestamp with time zone not null default now(),
  constraint project_links_title_not_empty check (length(trim(title)) > 0),
  constraint project_links_url_not_empty check (length(trim(url)) > 0)
);

create index if not exists idx_project_links_project_id_created_at
  on public.project_links(project_id, created_at desc);

alter table public.project_links enable row level security;

create policy "Users can view links for accessible projects"
on public.project_links
for select
using (public.can_access_project(project_id));

create policy "Project members can add links"
on public.project_links
for insert
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.creator_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_links.project_id
        and pm.user_id = auth.uid()
    )
  )
);

create policy "Link owners or project creators can delete links"
on public.project_links
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.creator_id = auth.uid()
  )
);
