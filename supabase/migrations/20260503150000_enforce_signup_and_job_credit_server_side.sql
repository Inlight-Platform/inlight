-- Enforce signup domain restrictions and consume job credits server-side.

create or replace function public.enforce_signup_email_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(coalesce(new.email, ''));
begin
  if normalized_email = '' then
    return new;
  end if;

  if normalized_email like '%@nyu.edu'
     or normalized_email in ('info@inlight.social', 'alabfestival@gmail.com', 'clelyfdes@gmail.com') then
    return new;
  end if;

  raise exception 'Only nyu.edu email addresses are allowed to sign up.';
end;
$function$;

drop trigger if exists enforce_signup_email_policy_on_auth_users on auth.users;
create trigger enforce_signup_email_policy_on_auth_users
before insert on auth.users
for each row
execute function public.enforce_signup_email_policy();

create or replace function public.enforce_opportunity_credit_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null or auth.uid() <> new.posted_by then
    raise exception 'Not authorized to post this opportunity';
  end if;

  if public.has_role(auth.uid(), 'admin'::public.app_role) then
    return new;
  end if;

  update public.job_post_credits
     set credits = credits - 1,
         updated_at = now()
   where user_id = new.posted_by
     and credits > 0;

  if not found then
    raise exception 'Insufficient job posting credits';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_opportunity_credit_on_insert on public.opportunities;
create trigger enforce_opportunity_credit_on_insert
before insert on public.opportunities
for each row
execute function public.enforce_opportunity_credit_on_insert();
