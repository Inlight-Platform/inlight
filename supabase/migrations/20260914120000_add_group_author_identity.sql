-- Allow group admins to publish posts, jobs, and events under a group identity.

alter table public.posts
  add column if not exists author_identity text not null default 'personal',
  add column if not exists author_group_id uuid references public.groups(id) on delete set null;

alter table public.events
  add column if not exists author_identity text not null default 'personal',
  add column if not exists author_group_id uuid references public.groups(id) on delete set null;

alter table public.projects
  add column if not exists author_identity text not null default 'personal',
  add column if not exists author_group_id uuid references public.groups(id) on delete set null;

alter table public.posts
  drop constraint if exists posts_author_identity_check;

alter table public.posts
  add constraint posts_author_identity_check
  check (author_identity in ('personal', 'group'));

alter table public.events
  drop constraint if exists events_author_identity_check;

alter table public.events
  add constraint events_author_identity_check
  check (author_identity in ('personal', 'group'));

alter table public.projects
  drop constraint if exists projects_author_identity_check;

alter table public.projects
  add constraint projects_author_identity_check
  check (author_identity in ('personal', 'group'));

create or replace function public.is_scoped_group_admin(_user uuid, _group uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _email text;
begin
  if _user is null or _group is null then
    return false;
  end if;

  select lower(email) into _email
  from auth.users
  where id = _user;

  return exists (
    select 1
    from public.group_admins ga
    where ga.group_id = _group
      and ga.status = 'active'
      and (
        ga.user_id = _user
        or (ga.email is not null and _email is not null and lower(ga.email) = _email)
      )
  )
  or exists (
    select 1
    from public.groups g
    where g.id = _group
      and g.faculty_owner_id = _user
  );
end;
$$;

grant execute on function public.is_scoped_group_admin(uuid, uuid) to authenticated;

create or replace function public.get_my_scoped_admin_groups()
returns table(id uuid, slug text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.slug, g.name
  from public.groups g
  where public.is_scoped_group_admin(auth.uid(), g.id)
  order by g.name;
$$;

grant execute on function public.get_my_scoped_admin_groups() to authenticated;

create or replace function public.validate_group_author_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_identity is null then
    new.author_identity := 'personal';
  end if;

  if new.author_identity = 'personal' then
    new.author_group_id := null;
    return new;
  end if;

  if new.author_identity <> 'group' then
    raise exception 'Invalid author identity';
  end if;

  if new.author_group_id is null then
    raise exception 'Choose a group identity';
  end if;

  if auth.uid() is null or not public.is_scoped_group_admin(auth.uid(), new.author_group_id) then
    raise exception 'Only group admins can post under a group identity';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_posts_group_author_identity on public.posts;
create trigger validate_posts_group_author_identity
  before insert or update of author_identity, author_group_id on public.posts
  for each row
  execute function public.validate_group_author_identity();

drop trigger if exists validate_events_group_author_identity on public.events;
create trigger validate_events_group_author_identity
  before insert or update of author_identity, author_group_id on public.events
  for each row
  execute function public.validate_group_author_identity();

drop trigger if exists validate_projects_group_author_identity on public.projects;
create trigger validate_projects_group_author_identity
  before insert or update of author_identity, author_group_id on public.projects
  for each row
  execute function public.validate_group_author_identity();

notify pgrst, 'reload schema';
