-- Resolve the minimal department identity needed to render accessible content
-- without granting direct access to private group records.
create or replace function public.get_public_group_authors(_group_ids uuid[])
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name
  from public.groups g
  where g.id = any(coalesce(_group_ids, array[]::uuid[]))
    and (
      exists (
        select 1
        from public.posts p
        where p.author_identity = 'group'
          and p.author_group_id = g.id
          and public.can_view_post(p)
      )
      or exists (
        select 1
        from public.events e
        where e.author_identity = 'group'
          and e.author_group_id = g.id
          and public.can_view_event(e)
      )
      or exists (
        select 1
        from public.projects project
        where project.author_identity = 'group'
          and project.author_group_id = g.id
          and public.can_access_project(project.id)
      )
    )
  order by g.name;
$$;

revoke all on function public.get_public_group_authors(uuid[]) from public;
grant execute on function public.get_public_group_authors(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
