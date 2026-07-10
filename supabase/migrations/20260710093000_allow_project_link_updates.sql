create policy "Link owners or project creators can update links"
on public.project_links
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.creator_id = auth.uid()
  )
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_links.project_id
        and pm.user_id = auth.uid()
    )
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.creator_id = auth.uid()
  )
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_links.project_id
        and pm.user_id = auth.uid()
    )
  )
);
