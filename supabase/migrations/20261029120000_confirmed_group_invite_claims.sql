create or replace function public.claim_group_member_invites_for_user(_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text;
  claimed_count integer := 0;
begin
  if _user_id is null then
    return 0;
  end if;

  select lower(btrim(email))
    into normalized_email
    from auth.users
   where id = _user_id
     and email_confirmed_at is not null;

  if normalized_email is null or normalized_email = '' then
    return 0;
  end if;

  with matching_invites as (
    select gi.id, gi.group_id, gi.membership_status_on_accept
      from public.group_invites gi
     where lower(gi.email) = normalized_email
       and gi.status = 'pending'
  ),
  upserted_members as (
    insert into public.group_members (group_id, user_id, status)
    select group_id, _user_id, membership_status_on_accept
      from matching_invites
    on conflict (group_id, user_id)
    do update
          set status = excluded.status,
              joined_at = case
                when public.group_members.status is distinct from excluded.status then now()
                else public.group_members.joined_at
              end
    returning group_id
  )
  update public.group_invites gi
     set status = 'accepted',
         accepted_by = _user_id,
         accepted_at = coalesce(gi.accepted_at, now()),
         updated_at = now()
    from matching_invites mi
   where gi.id = mi.id;

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$function$;

create or replace function public.claim_pending_group_admins_for_user(_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text;
  claimed_count integer := 0;
begin
  if _user_id is null then
    return 0;
  end if;

  select lower(email)
    into normalized_email
    from auth.users
   where id = _user_id
     and email_confirmed_at is not null;

  if normalized_email is null or normalized_email = '' then
    return 0;
  end if;

  update public.group_admins
     set user_id = _user_id,
         email = normalized_email,
         status = 'active',
         updated_at = now()
   where lower(email) = normalized_email
     and status = 'pending'
     and (user_id is null or user_id = _user_id);

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$function$;

revoke execute on function public.claim_pending_group_admins_for_user(uuid) from public, anon, authenticated;
revoke execute on function public.claim_group_member_invites_for_user(uuid) from public, anon, authenticated;

create or replace function public.accept_platform_invite_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.platform_invites
     set accepted_at = coalesce(accepted_at, now()),
         accepted_by = coalesce(accepted_by, new.id)
   where lower(email) = lower(coalesce(new.email, ''))
     and accepted_at is null;

  if new.email_confirmed_at is not null then
    perform public.claim_pending_group_admins_for_user(new.id);
    perform public.claim_group_member_invites_for_user(new.id);
  end if;

  return new;
end;
$function$;

create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  safe_display_name text;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    safe_display_name := coalesce(
      trim(substring(new.raw_user_meta_data->>'display_name' from 1 for 100)),
      split_part(new.email, '@', 1)
    );

    if length(safe_display_name) = 0 then
      safe_display_name := split_part(new.email, '@', 1);
    end if;

    insert into public.profiles (user_id, email, display_name)
    values (new.id, new.email, safe_display_name)
    on conflict (user_id) do nothing;

    perform public.claim_pending_group_admins_for_user(new.id);
    perform public.claim_group_member_invites_for_user(new.id);
  end if;

  return new;
end;
$function$;
