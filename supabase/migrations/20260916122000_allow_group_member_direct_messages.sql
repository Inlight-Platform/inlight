-- Let active department members and scoped admins message active members.

create or replace function public.can_message_through_group(_target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and _target_user is not null
    and _target_user <> auth.uid()
    and exists (
      select 1
      from public.group_members target_membership
      where target_membership.user_id = _target_user
        and target_membership.status = 'active'
        and (
          public.is_group_member(auth.uid(), target_membership.group_id)
          or public.is_scoped_group_admin(auth.uid(), target_membership.group_id)
        )
    );
$$;

revoke all on function public.can_message_through_group(uuid) from public;
grant execute on function public.can_message_through_group(uuid) to authenticated;

notify pgrst, 'reload schema';
