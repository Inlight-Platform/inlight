create or replace function public.book_group_audition_timeslot(
  _audition_id uuid,
  _timeslot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audition_group_id uuid;
  audition_is_published boolean;
  slot_capacity integer;
  booked_count integer;
  signup_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select group_id, is_published
  into audition_group_id, audition_is_published
  from public.group_auditions
  where id = _audition_id;

  if audition_group_id is null or not audition_is_published then
    raise exception 'Audition not found or unavailable';
  end if;

  if not public.is_group_member(auth.uid(), audition_group_id)
    and not public.is_scoped_group_admin(auth.uid(), audition_group_id) then
    raise exception 'Only department members and admins can book this audition';
  end if;

  select capacity
  into slot_capacity
  from public.group_audition_timeslots
  where id = _timeslot_id
    and audition_id = _audition_id
  for update;

  if slot_capacity is null then
    raise exception 'Timeslot not found for this audition';
  end if;

  select count(*)::integer
  into booked_count
  from public.group_audition_signups
  where timeslot_id = _timeslot_id
    and user_id <> auth.uid();

  if booked_count >= slot_capacity then
    raise exception 'This timeslot is full';
  end if;

  insert into public.group_audition_signups (
    audition_id,
    timeslot_id,
    user_id
  ) values (
    _audition_id,
    _timeslot_id,
    auth.uid()
  )
  on conflict (audition_id, user_id)
  do update set
    timeslot_id = excluded.timeslot_id,
    updated_at = now()
  returning id into signup_id;

  return signup_id;
end;
$$;

revoke all on function public.book_group_audition_timeslot(uuid, uuid) from public;
revoke all on function public.book_group_audition_timeslot(uuid, uuid) from anon;
grant execute on function public.book_group_audition_timeslot(uuid, uuid) to authenticated;
