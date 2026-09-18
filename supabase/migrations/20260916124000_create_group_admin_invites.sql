-- Create scoped group-admin assignments and signup invitations together.

create or replace function public.create_group_admin_invite(
  _group_id uuid,
  _email text,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  normalized_note text := nullif(btrim(coalesce(_note, '')), '');
  admin_row public.group_admins%rowtype;
  platform_invite_row public.platform_invites%rowtype;
  group_row public.groups%rowtype;
begin
  if auth.uid() is null or not public.is_scoped_group_admin(auth.uid(), _group_id) then
    raise exception 'Not authorized to manage group admins';
  end if;

  select * into group_row
  from public.groups
  where id = _group_id;

  if group_row.id is null then
    raise exception 'Group not found';
  end if;

  admin_row := public.add_group_admin_by_email(_group_id, normalized_email);

  if admin_row.status = 'active' and admin_row.user_id is not null then
    return jsonb_build_object(
      'admin_id', admin_row.id,
      'email', admin_row.email,
      'status', admin_row.status,
      'existing_user', true,
      'group_name', group_row.name,
      'group_slug', group_row.slug
    );
  end if;

  select * into platform_invite_row
  from public.platform_invites
  where lower(email) = normalized_email
    and accepted_at is null
  order by created_at desc
  limit 1;

  if platform_invite_row.id is null then
    insert into public.platform_invites (email, inviter_id, personal_note)
    values (normalized_email, auth.uid(), normalized_note)
    returning * into platform_invite_row;
  else
    update public.platform_invites
    set personal_note = normalized_note
    where id = platform_invite_row.id
    returning * into platform_invite_row;
  end if;

  return jsonb_build_object(
    'admin_id', admin_row.id,
    'email', admin_row.email,
    'status', admin_row.status,
    'existing_user', false,
    'token', platform_invite_row.token,
    'group_name', group_row.name,
    'group_slug', group_row.slug
  );
end;
$function$;

revoke all on function public.create_group_admin_invite(uuid, text, text) from public;
grant execute on function public.create_group_admin_invite(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
