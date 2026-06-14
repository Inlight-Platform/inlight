-- Let invite links authorize signup by token as well as by pending invite email.

create or replace function public.is_signup_email_allowed(
  _email text,
  _platform_token text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    lower(coalesce(_email, '')) ~ '^[^@]+@[^@]+\.edu$'
    or lower(coalesce(_email, '')) in (
      'info@inlight.social',
      'alabfestival@gmail.com',
      'clelyfdes@gmail.com',
      'clelyfernandes19@gmail.com',
      'baileymadison941@gmail.com'
    )
    or exists (
      select 1
      from public.platform_invites pi
      where lower(pi.email) = lower(btrim(coalesce(_email, '')))
        and pi.accepted_at is null
        and (
          nullif(btrim(coalesce(_platform_token, '')), '') is null
          or pi.token = btrim(_platform_token)
        )
    )
$function$;

create or replace function public.enforce_signup_email_policy()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  platform_token text := new.raw_user_meta_data ->> 'platform_invite_token';
begin
  if normalized_email = '' then
    return new;
  end if;

  if public.is_signup_email_allowed(normalized_email, platform_token) then
    return new;
  end if;

  raise exception 'Only university .edu email addresses or invited emails are allowed to sign up.';
end;
$function$;

grant execute on function public.is_signup_email_allowed(text, text) to anon, authenticated;
