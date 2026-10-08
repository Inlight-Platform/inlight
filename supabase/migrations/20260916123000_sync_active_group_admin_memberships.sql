-- Active group admins are also active members of their department.

create or replace function public.sync_active_group_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'active' and new.user_id is not null then
    insert into public.group_members (group_id, user_id, status)
    values (new.group_id, new.user_id, 'active')
    on conflict (group_id, user_id)
    do update
          set status = 'active',
              joined_at = case
                when public.group_members.status is distinct from 'active' then now()
                else public.group_members.joined_at
              end;
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_active_group_admin_membership on public.group_admins;
create trigger sync_active_group_admin_membership
  after insert or update of user_id, status on public.group_admins
  for each row
  execute function public.sync_active_group_admin_membership();

insert into public.group_members (group_id, user_id, status)
select group_id, user_id, 'active'
from public.group_admins
where status = 'active'
  and user_id is not null
on conflict (group_id, user_id)
do update
      set status = 'active',
          joined_at = case
            when public.group_members.status is distinct from 'active' then now()
            else public.group_members.joined_at
          end;

notify pgrst, 'reload schema';
