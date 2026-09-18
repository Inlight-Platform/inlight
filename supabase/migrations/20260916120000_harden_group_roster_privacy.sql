-- Limit department rosters and member counts to active members and scoped admins.

drop policy if exists "Members can view roster of their group" on public.group_members;

create policy "Members can view permitted group roster rows"
on public.group_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_scoped_group_admin(auth.uid(), group_id)
  or (
    status = 'active'
    and public.is_group_member(auth.uid(), group_id)
  )
);

create or replace function public.get_group_active_member_count(_group_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_group_member(auth.uid(), _group_id)
    or public.is_scoped_group_admin(auth.uid(), _group_id)
  ) then
    raise exception 'Not authorized to view this group roster';
  end if;

  return (
    select count(*)::integer
    from public.group_members
    where group_id = _group_id
      and status = 'active'
  );
end;
$$;

revoke all on function public.get_group_active_member_count(uuid) from public;
revoke execute on function public.get_group_active_member_count(uuid) from anon;
grant execute on function public.get_group_active_member_count(uuid) to authenticated;

notify pgrst, 'reload schema';
