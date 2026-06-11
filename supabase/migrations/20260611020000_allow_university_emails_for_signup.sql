-- Keep the server-side signup rule aligned with the client: any .edu
-- address may sign up, with a small explicit allowlist for admin/test users.

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

  if normalized_email ~ '^[^@]+@[^@]+\.edu$'
     or normalized_email in (
       'info@inlight.social',
       'alabfestival@gmail.com',
       'clelyfdes@gmail.com',
       'clelyfernandes19@gmail.com',
       'baileymadison941@gmail.com'
     ) then
    return new;
  end if;

  raise exception 'Only university .edu email addresses are allowed to sign up.';
end;
$function$;
