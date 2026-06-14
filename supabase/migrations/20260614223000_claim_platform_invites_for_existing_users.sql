-- Mark platform invites accepted when the invited auth user already exists,
-- and keep future invites in sync with existing auth users.

create or replace function public.create_platform_invite(_email text, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  invite_row public.platform_invites%rowtype;
  existing_user_id uuid;
begin
  if auth.uid() is null or not public.is_platform_inviter(auth.uid()) then
    raise exception 'Not authorized to create platform invites';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  select u.id
    into existing_user_id
    from auth.users u
   where lower(u.email) = normalized_email
   limit 1;

  select *
    into invite_row
    from public.platform_invites
   where lower(email) = normalized_email
     and accepted_at is null
   limit 1;

  if found then
    update public.platform_invites
       set personal_note = nullif(btrim(_note), ''),
           accepted_at = case when existing_user_id is not null then now() else accepted_at end,
           accepted_by = coalesce(accepted_by, existing_user_id)
     where id = invite_row.id
     returning * into invite_row;
  else
    insert into public.platform_invites (email, inviter_id, personal_note, accepted_at, accepted_by)
    values (
      normalized_email,
      auth.uid(),
      nullif(btrim(_note), ''),
      case when existing_user_id is not null then now() else null end,
      existing_user_id
    )
    returning * into invite_row;
  end if;

  return jsonb_build_object(
    'id', invite_row.id,
    'email', invite_row.email,
    'token', invite_row.token,
    'created_at', invite_row.created_at,
    'accepted_at', invite_row.accepted_at
  );
end;
$function$;

update public.platform_invites pi
   set accepted_at = coalesce(pi.accepted_at, now()),
       accepted_by = coalesce(pi.accepted_by, u.id)
  from auth.users u
 where lower(u.email) = lower(pi.email)
   and pi.accepted_at is null;
