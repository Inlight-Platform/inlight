create or replace function public.create_group_member_invites(
  _group_id uuid,
  _emails text[],
  _note text default null,
  _membership_status_on_accept text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_email text;
  normalized_email text;
  normalized_note text := nullif(btrim(coalesce(_note, '')), '');
  member_status text := lower(btrim(coalesce(_membership_status_on_accept, 'active')));
  seen_emails text[] := '{}';
  target_user_id uuid;
  invite_row public.group_invites%rowtype;
  accepted_invites jsonb := '[]'::jsonb;
  pending_invites jsonb := '[]'::jsonb;
  invalid_emails jsonb := '[]'::jsonb;
  duplicate_emails jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if _group_id is null then
    raise exception 'Group is required';
  end if;

  if not public.is_scoped_group_admin(auth.uid(), _group_id) then
    raise exception 'Only group admins can invite members';
  end if;

  if member_status not in ('active', 'pending') then
    raise exception 'Invalid membership status on accept';
  end if;

  if coalesce(array_length(_emails, 1), 0) = 0 then
    raise exception 'At least one email is required';
  end if;

  foreach raw_email in array _emails loop
    normalized_email := lower(btrim(coalesce(raw_email, '')));

    if normalized_email = '' then
      continue;
    end if;

    if normalized_email !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' then
      invalid_emails := invalid_emails || jsonb_build_array(
        jsonb_build_object('input', raw_email)
      );
      continue;
    end if;

    if normalized_email = any(seen_emails) then
      duplicate_emails := duplicate_emails || jsonb_build_array(
        jsonb_build_object('email', normalized_email)
      );
      continue;
    end if;

    seen_emails := array_append(seen_emails, normalized_email);

    target_user_id := null;
    invite_row := null;

    select au.id
      into target_user_id
      from auth.users au
      where lower(au.email) = normalized_email
      order by au.created_at desc
      limit 1;

    select gi.*
      into invite_row
      from public.group_invites gi
      where gi.group_id = _group_id
        and lower(gi.email) = normalized_email
        and gi.status in ('pending', 'accepted')
      order by gi.created_at desc
      limit 1;

    if target_user_id is not null then
      if invite_row.id is null then
        insert into public.group_invites (
          group_id,
          email,
          invited_by,
          personal_note,
          status,
          membership_status_on_accept,
          accepted_by,
          accepted_at
        )
        values (
          _group_id,
          normalized_email,
          auth.uid(),
          normalized_note,
          'accepted',
          member_status,
          target_user_id,
          now()
        )
        returning * into invite_row;
      else
        update public.group_invites
          set email = normalized_email,
              invited_by = auth.uid(),
              personal_note = normalized_note,
              status = 'accepted',
              membership_status_on_accept = member_status,
              accepted_by = target_user_id,
              accepted_at = coalesce(accepted_at, now()),
              updated_at = now()
          where id = invite_row.id
          returning * into invite_row;
      end if;

      insert into public.group_members (group_id, user_id, status)
      values (_group_id, target_user_id, member_status)
      on conflict (group_id, user_id)
      do update set status = excluded.status;

      accepted_invites := accepted_invites || jsonb_build_array(
        jsonb_build_object(
          'id', invite_row.id,
          'email', invite_row.email,
          'user_id', target_user_id,
          'membership_status', member_status
        )
      );
    else
      if invite_row.id is null then
        insert into public.group_invites (
          group_id,
          email,
          invited_by,
          personal_note,
          status,
          membership_status_on_accept
        )
        values (
          _group_id,
          normalized_email,
          auth.uid(),
          normalized_note,
          'pending',
          member_status
        )
        returning * into invite_row;
      else
        update public.group_invites
          set email = normalized_email,
              invited_by = auth.uid(),
              personal_note = normalized_note,
              status = 'pending',
              membership_status_on_accept = member_status,
              accepted_by = null,
              accepted_at = null,
              updated_at = now()
          where id = invite_row.id
          returning * into invite_row;
      end if;

      pending_invites := pending_invites || jsonb_build_array(
        jsonb_build_object(
          'id', invite_row.id,
          'email', invite_row.email,
          'membership_status_on_accept', invite_row.membership_status_on_accept
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'accepted', accepted_invites,
    'pending', pending_invites,
    'invalid', invalid_emails,
    'duplicates', duplicate_emails,
    'counts', jsonb_build_object(
      'accepted', jsonb_array_length(accepted_invites),
      'pending', jsonb_array_length(pending_invites),
      'invalid', jsonb_array_length(invalid_emails),
      'duplicates', jsonb_array_length(duplicate_emails)
    )
  );
end;
$$;

grant execute on function public.create_group_member_invites(uuid, text[], text, text) to authenticated;

notify pgrst, 'reload schema';
