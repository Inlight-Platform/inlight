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
   where id = _user_id;

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

grant execute on function public.claim_group_member_invites_for_user(uuid) to authenticated;

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

  perform public.claim_pending_group_admins_for_user(new.id);
  perform public.claim_group_member_invites_for_user(new.id);

  return new;
end;
$function$;

create or replace function public.claim_invites_on_signup(
  _credit_token text default null,
  _platform_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  platform_claimed boolean := false;
  credit_claim_result jsonb := jsonb_build_object('claimed', false);
  platform_rows integer := 0;
  group_admin_rows integer := 0;
  group_member_rows integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(btrim(_platform_token), '') is not null then
    update public.platform_invites pi
       set accepted_at = coalesce(pi.accepted_at, now()),
           accepted_by = coalesce(pi.accepted_by, auth.uid())
     where pi.token = btrim(_platform_token)
       and lower(pi.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and pi.accepted_at is null;

    get diagnostics platform_rows = row_count;
    platform_claimed := platform_rows > 0;
  end if;

  group_admin_rows := public.claim_pending_group_admins_for_user(auth.uid());
  group_member_rows := public.claim_group_member_invites_for_user(auth.uid());

  if nullif(btrim(_credit_token), '') is not null then
    credit_claim_result := public.accept_project_credit_invite(_credit_token);
  end if;

  return jsonb_build_object(
    'platform_invite_claimed', platform_claimed,
    'credit_invite_claimed', coalesce((credit_claim_result ->> 'claimed')::boolean, false),
    'credit_invite', credit_claim_result,
    'group_admin_invites_claimed', group_admin_rows,
    'group_member_invites_claimed', group_member_rows
  );
end;
$function$;

notify pgrst, 'reload schema';
