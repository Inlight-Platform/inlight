-- Move authenticated-callable SECURITY DEFINER logic behind non-exposed private
-- helpers, drop broad profile-media listing, and replace remaining literal true
-- write policies with constrained checks.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

grant execute on function private.has_role(uuid, public.app_role) to anon, authenticated;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.has_role(_user_id, _role)
$$;

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

create or replace function private.can_view_post(post_row public.posts)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when post_row.visibility = 'public' then true
    when post_row.user_id = auth.uid() then true
    when post_row.visibility = 'network' then exists (
      select 1 from connections c1
      inner join connections c2
        on c1.follower_id = c2.following_id
        and c1.following_id = c2.follower_id
      where c1.follower_id = post_row.user_id
        and c1.following_id = auth.uid()
    )
    when post_row.visibility = 'specific' then exists (
      select 1 from post_recipients
      where post_id = post_row.id
        and recipient_id = auth.uid()
    )
    else false
  end
$$;

grant execute on function private.can_view_post(public.posts) to authenticated;

create or replace function public.can_view_post(post_row public.posts)
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.can_view_post(post_row)
$$;

create or replace function private.get_message_privacy(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(message_privacy, 'mutuals_only')
  from public.profiles
  where user_id = target_user_id
  limit 1
$$;

grant execute on function private.get_message_privacy(uuid) to authenticated;

create or replace function public.get_message_privacy(target_user_id uuid)
returns text
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.get_message_privacy(target_user_id)
$$;

create or replace function private.get_mutual_connections(target_user_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c1.following_id as user_id
  from connections c1
  inner join connections c2
    on c1.follower_id = c2.following_id
    and c1.following_id = c2.follower_id
  where c1.follower_id = target_user_id
$$;

grant execute on function private.get_mutual_connections(uuid) to authenticated;

create or replace function public.get_mutual_connections(target_user_id uuid)
returns table(user_id uuid)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.get_mutual_connections(target_user_id)
$$;

create or replace function private.get_2nd_degree_connections(target_user_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with first_degree as (
    select c1.following_id as user_id
    from connections c1
    inner join connections c2
      on c1.follower_id = c2.following_id
      and c1.following_id = c2.follower_id
    where c1.follower_id = target_user_id
  )
  select distinct c1.following_id as user_id
  from first_degree fd
  inner join connections c1 on c1.follower_id = fd.user_id
  inner join connections c2
    on c1.follower_id = c2.following_id
    and c1.following_id = c2.follower_id
  where c1.following_id != target_user_id
    and c1.following_id not in (select user_id from first_degree)
$$;

grant execute on function private.get_2nd_degree_connections(uuid) to authenticated;

create or replace function public.get_2nd_degree_connections(target_user_id uuid)
returns table(user_id uuid)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.get_2nd_degree_connections(target_user_id)
$$;

create or replace function private.get_public_event_rsvps(target_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  role_type text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.event_id,
    r.user_id,
    r.name,
    r.role_type,
    r.status,
    r.created_at
  from public.event_rsvps r
  where r.event_id = target_event_id
  order by r.created_at asc
$$;

grant execute on function private.get_public_event_rsvps(uuid) to anon, authenticated;

create or replace function public.get_public_event_rsvps(target_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  role_type text,
  status text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.get_public_event_rsvps(target_event_id)
$$;

create or replace function private.add_project_member_by_email(
  target_project_id uuid,
  target_email text,
  target_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = target_project_id
      and creator_id = auth.uid()
  ) then
    raise exception 'Only the project creator can add members';
  end if;

  select user_id
  into resolved_user_id
  from public.profiles
  where lower(email) = lower(trim(target_email))
  limit 1;

  if resolved_user_id is null then
    raise exception 'User not found';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (target_project_id, resolved_user_id, nullif(trim(target_role), ''))
  on conflict (project_id, user_id) do update
  set role = excluded.role;
end;
$$;

grant execute on function private.add_project_member_by_email(uuid, text, text) to authenticated;

create or replace function public.add_project_member_by_email(
  target_project_id uuid,
  target_email text,
  target_role text default null
)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  perform private.add_project_member_by_email(target_project_id, target_email, target_role);
end;
$$;

-- Preserve wrapper execute grants, but only on invoker functions in public.
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;
grant execute on function public.can_view_post(public.posts) to authenticated;
grant execute on function public.get_message_privacy(uuid) to authenticated;
grant execute on function public.get_mutual_connections(uuid) to authenticated;
grant execute on function public.get_2nd_degree_connections(uuid) to authenticated;
grant execute on function public.get_public_event_rsvps(uuid) to anon, authenticated;
grant execute on function public.add_project_member_by_email(uuid, text, text) to authenticated;

-- Public bucket URLs should stay accessible, but listing storage.objects should not.
drop policy if exists "Public can view all profile media" on storage.objects;

-- Keep guest RSVP support but avoid a literal true policy.
drop policy if exists "Anyone can RSVP" on public.event_rsvps;
create policy "Anyone can RSVP"
on public.event_rsvps
for insert
with check (
  event_id is not null
  and nullif(btrim(name), '') is not null
  and nullif(btrim(email), '') is not null
  and nullif(btrim(role_type), '') is not null
  and status in ('going', 'cant_make_it')
  and (user_id is null or auth.uid() = user_id)
);
