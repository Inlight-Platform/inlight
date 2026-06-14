-- Give the test account the same admin role behavior as the Inlight account.

create or replace function public.is_admin_email(_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select lower(coalesce(_email, '')) in (
    'info@inlight.social',
    'clelyfernandes19@gmail.com'
  )
$function$;

create or replace function public.auto_assign_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.is_admin_email(new.email) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$function$;

insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where public.is_admin_email(u.email)
on conflict (user_id, role) do nothing;
