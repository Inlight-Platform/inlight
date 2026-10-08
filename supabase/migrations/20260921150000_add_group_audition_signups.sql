alter table public.group_audition_timeslots
  add constraint group_audition_timeslots_id_audition_id_key unique (id, audition_id);

create table public.group_audition_signups (
  id uuid primary key default gen_random_uuid(),
  audition_id uuid not null references public.group_auditions(id) on delete cascade,
  timeslot_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_audition_signups_timeslot_audition_fkey
    foreign key (timeslot_id, audition_id)
    references public.group_audition_timeslots(id, audition_id)
    on delete cascade,
  constraint group_audition_signups_one_per_audition unique (audition_id, user_id)
);

create index group_audition_signups_timeslot_id_idx
  on public.group_audition_signups(timeslot_id);
create index group_audition_signups_user_id_idx
  on public.group_audition_signups(user_id);

alter table public.group_audition_signups enable row level security;

create policy "Members can read their own audition signups"
on public.group_audition_signups for select
to authenticated
using (user_id = auth.uid());

create policy "Group admins can read department audition signups"
on public.group_audition_signups for select
to authenticated
using (
  exists (
    select 1
    from public.group_auditions audition
    where audition.id = audition_id
      and public.is_scoped_group_admin(auth.uid(), audition.group_id)
  )
);

grant select on public.group_audition_signups to authenticated;

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

  if not public.is_group_member(auth.uid(), audition_group_id) then
    raise exception 'Only active department members can book this audition';
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

create or replace function public.get_group_audition_availability(_group_id uuid)
returns table (
  audition_id uuid,
  timeslot_id uuid,
  booked_count integer,
  capacity integer,
  is_my_timeslot boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_group_member(auth.uid(), _group_id)
    and not public.is_scoped_group_admin(auth.uid(), _group_id) then
    raise exception 'Department membership required';
  end if;

  return query
  select
    audition.id,
    slot.id,
    count(signup.id)::integer,
    slot.capacity,
    bool_or(signup.user_id = auth.uid())
  from public.group_auditions audition
  join public.group_audition_timeslots slot on slot.audition_id = audition.id
  left join public.group_audition_signups signup on signup.timeslot_id = slot.id
  where audition.group_id = _group_id
    and audition.is_published
  group by audition.id, slot.id, slot.capacity, slot.starts_at
  order by slot.starts_at;
end;
$$;

revoke all on function public.book_group_audition_timeslot(uuid, uuid) from public;
revoke all on function public.book_group_audition_timeslot(uuid, uuid) from anon;
grant execute on function public.book_group_audition_timeslot(uuid, uuid) to authenticated;

revoke all on function public.get_group_audition_availability(uuid) from public;
revoke all on function public.get_group_audition_availability(uuid) from anon;
grant execute on function public.get_group_audition_availability(uuid) to authenticated;
