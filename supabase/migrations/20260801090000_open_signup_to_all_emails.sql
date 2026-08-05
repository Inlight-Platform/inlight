-- Open signup to every valid email domain while keeping email confirmation intact.

create or replace function public.is_signup_email_allowed(
  _email text,
  _platform_token text default null,
  _credit_token text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select lower(btrim(coalesce(_email, ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
$function$;

create or replace function public.enforce_signup_email_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(btrim(coalesce(new.email, '')));
begin
  if normalized_email = '' then
    return new;
  end if;

  if public.is_signup_email_allowed(normalized_email, null, null) then
    return new;
  end if;

  raise exception 'Enter a valid email address.';
end;
$function$;

grant execute on function public.is_signup_email_allowed(text, text, text) to anon, authenticated;
