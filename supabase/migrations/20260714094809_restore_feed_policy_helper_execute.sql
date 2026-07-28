-- Restore execute privileges for public RLS helper functions used by the feed.
--
-- These helpers are not admin RPCs; they are part of SELECT policies. If anon
-- cannot execute them, PostgREST fails feed reads with "permission denied for
-- function ..." instead of returning visible public rows.

create or replace function public.can_view_post(post_row public.posts)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  can_view_group boolean := false;
begin
  if not public.profile_is_visible_to_current_user(post_row.user_id) then
    return false;
  end if;

  if post_row.visibility = 'public' then
    return true;
  end if;

  if post_row.user_id = auth.uid() then
    return true;
  end if;

  if post_row.visibility = 'network' then
    return exists (
      select 1
      from public.connections c1
      inner join public.connections c2
        on c1.follower_id = c2.following_id
        and c1.following_id = c2.follower_id
      where c1.follower_id = post_row.user_id
        and c1.following_id = auth.uid()
    );
  end if;

  if post_row.visibility = 'specific' then
    return exists (
      select 1
      from public.post_recipients
      where post_id = post_row.id
        and recipient_id = auth.uid()
    );
  end if;

  if post_row.visibility = 'group' and to_regclass('public.post_groups') is not null then
    execute $sql$
      select exists (
        select 1
        from public.post_groups pg
        where pg.post_id = $1
          and (
            public.is_group_member(auth.uid(), pg.group_id)
            or public.is_group_faculty(auth.uid(), pg.group_id)
          )
      )
    $sql$ into can_view_group using post_row.id;

    return can_view_group;
  end if;

  return false;
end
$$;

revoke all on function public.can_view_post(public.posts) from public;
grant execute on function public.can_view_post(public.posts) to anon, authenticated;

create or replace function public.is_invited_to_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_invited_to_project(target_project_id)
$$;

revoke all on function public.is_invited_to_project(uuid) from public;
grant execute on function public.is_invited_to_project(uuid) to anon, authenticated;

create or replace function public.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.can_access_project(target_project_id)
$$;

revoke all on function public.can_access_project(uuid) from public;
grant execute on function public.can_access_project(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
