-- Keep department portal access scoped to direct group admins and active members.

create or replace function public.get_my_faculty_group()
returns table(id uuid, slug text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.slug, g.name
  from public.groups g
  where public.is_scoped_group_admin(auth.uid(), g.id)
  order by g.name
  limit 1;
$$;

create or replace function public.get_my_groups()
returns table(id uuid, slug text, name text, is_faculty boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.slug, g.name, public.is_scoped_group_admin(auth.uid(), g.id) as is_faculty
  from public.groups g
  where public.is_scoped_group_admin(auth.uid(), g.id)
     or exists (
       select 1
       from public.group_members gm
       where gm.group_id = g.id
         and gm.user_id = auth.uid()
         and gm.status = 'active'
     )
  order by g.name;
$$;

notify pgrst, 'reload schema';
