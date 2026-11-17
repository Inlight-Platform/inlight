-- Permit platform admins to use the existing scoped assignment and invitation path.
create or replace function public.create_group_admin_invite(_group_id uuid, _email text, _note text default null)
returns jsonb language plpgsql security definer set search_path = public, auth
as $function$
declare
  normalized_email text := lower(btrim(coalesce(_email, '')));
  normalized_note text := nullif(btrim(coalesce(_note, '')), '');
  admin_row public.group_admins%rowtype;
  platform_invite_row public.platform_invites%rowtype;
  group_row public.groups%rowtype;
  account_exists boolean;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.is_scoped_group_admin(auth.uid(), _group_id)
  ) then raise exception 'Not authorized to manage group admins'; end if;

  select * into group_row from public.groups where id = _group_id;
  if group_row.id is null then raise exception 'Group not found'; end if;
  admin_row := public.add_group_admin_by_email(_group_id, normalized_email);
  if admin_row.status = 'active' and admin_row.user_id is not null then
    return jsonb_build_object('admin_id', admin_row.id, 'email', admin_row.email,
      'status', admin_row.status, 'existing_user', true, 'account_exists', true,
      'group_name', group_row.name, 'group_slug', group_row.slug);
  end if;

  select exists(select 1 from auth.users where lower(email) = normalized_email) into account_exists;
  select * into platform_invite_row from public.platform_invites
    where lower(email) = normalized_email and accepted_at is null
    order by created_at desc limit 1;
  if platform_invite_row.id is null then
    insert into public.platform_invites (email, inviter_id, personal_note)
    values (normalized_email, auth.uid(), normalized_note) returning * into platform_invite_row;
  else
    update public.platform_invites set personal_note = normalized_note
    where id = platform_invite_row.id returning * into platform_invite_row;
  end if;
  return jsonb_build_object('admin_id', admin_row.id, 'email', admin_row.email,
    'status', admin_row.status, 'existing_user', false, 'account_exists', account_exists,
    'token', platform_invite_row.token, 'group_name', group_row.name, 'group_slug', group_row.slug);
end;
$function$;

create or replace function public.admin_create_group_with_admins(
  _name text, _slug text, _description text, _admin_emails text[]
)
returns jsonb language plpgsql security definer set search_path = public, auth
as $function$
declare
  normalized_name text := btrim(coalesce(_name, ''));
  normalized_slug text := lower(btrim(coalesce(_slug, '')));
  normalized_email text;
  email text;
  seen text[] := array[]::text[];
  results jsonb := '[]'::jsonb;
  assignment jsonb;
  group_row public.groups%rowtype;
  assigned integer := 0;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin only';
  end if;
  if normalized_name = '' then raise exception 'Group name is required'; end if;
  if normalized_slug = '' or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Group slug can only use lowercase letters, numbers, and hyphens';
  end if;
  if not exists (select 1 from unnest(coalesce(_admin_emails, array[]::text[])) e
    where lower(btrim(coalesce(e, ''))) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'At least one valid admin email is required';
  end if;
  insert into public.groups (name, slug, description, faculty_owner_id)
  values (normalized_name, normalized_slug, nullif(btrim(coalesce(_description, '')), ''), null)
  returning * into group_row;

  foreach email in array coalesce(_admin_emails, array[]::text[]) loop
    normalized_email := lower(btrim(coalesce(email, '')));
    if normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      results := results || jsonb_build_array(jsonb_build_object('email', coalesce(email, ''), 'outcome', 'invalid'));
    elsif normalized_email = any(seen) then
      results := results || jsonb_build_array(jsonb_build_object('email', normalized_email, 'outcome', 'duplicate'));
    else
      seen := array_append(seen, normalized_email);
      begin
        assignment := public.create_group_admin_invite(group_row.id, normalized_email, null);
        assigned := assigned + 1;
        results := results || jsonb_build_array(jsonb_build_object('email', normalized_email,
          'outcome', 'assigned', 'status', assignment->>'status'));
      exception when others then
        results := results || jsonb_build_array(jsonb_build_object('email', normalized_email,
          'outcome', 'failed', 'error', SQLERRM));
      end;
    end if;
  end loop;
  if assigned = 0 then raise exception 'No admin assignments succeeded; group was not created'; end if;
  return jsonb_build_object('group', jsonb_build_object('id', group_row.id, 'name', group_row.name,
    'slug', group_row.slug), 'results', results);
end;
$function$;

revoke all on function public.admin_create_group_with_admins(text, text, text, text[]) from public, anon;
grant execute on function public.admin_create_group_with_admins(text, text, text, text[]) to authenticated;
notify pgrst, 'reload schema';
