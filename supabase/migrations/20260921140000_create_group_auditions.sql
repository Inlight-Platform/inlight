create table public.group_auditions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  materials text not null default '',
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_audition_timeslots (
  id uuid primary key default gen_random_uuid(),
  audition_id uuid not null references public.group_auditions(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  created_at timestamptz not null default now(),
  constraint group_audition_timeslots_valid_range check (ends_at > starts_at)
);

create index group_auditions_group_id_idx on public.group_auditions(group_id);
create index group_audition_timeslots_audition_id_idx on public.group_audition_timeslots(audition_id);
create index group_audition_timeslots_starts_at_idx on public.group_audition_timeslots(starts_at);

alter table public.group_auditions enable row level security;
alter table public.group_audition_timeslots enable row level security;

create policy "Group admins can read all group auditions"
on public.group_auditions for select
to authenticated
using (public.is_scoped_group_admin(auth.uid(), group_id));

create policy "Group members can read published group auditions"
on public.group_auditions for select
to authenticated
using (
  is_published
  and public.is_group_member(auth.uid(), group_id)
);

create policy "Group admins can create group auditions"
on public.group_auditions for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_scoped_group_admin(auth.uid(), group_id)
);

create policy "Group admins can update group auditions"
on public.group_auditions for update
to authenticated
using (public.is_scoped_group_admin(auth.uid(), group_id))
with check (public.is_scoped_group_admin(auth.uid(), group_id));

create policy "Group admins can delete group auditions"
on public.group_auditions for delete
to authenticated
using (public.is_scoped_group_admin(auth.uid(), group_id));

create policy "Authorized users can read group audition timeslots"
on public.group_audition_timeslots for select
to authenticated
using (
  exists (
    select 1
    from public.group_auditions audition
    where audition.id = audition_id
      and (
        public.is_scoped_group_admin(auth.uid(), audition.group_id)
        or (
          audition.is_published
          and public.is_group_member(auth.uid(), audition.group_id)
        )
      )
  )
);

create policy "Group admins can create group audition timeslots"
on public.group_audition_timeslots for insert
to authenticated
with check (
  exists (
    select 1
    from public.group_auditions audition
    where audition.id = audition_id
      and public.is_scoped_group_admin(auth.uid(), audition.group_id)
  )
);

create policy "Group admins can update group audition timeslots"
on public.group_audition_timeslots for update
to authenticated
using (
  exists (
    select 1
    from public.group_auditions audition
    where audition.id = audition_id
      and public.is_scoped_group_admin(auth.uid(), audition.group_id)
  )
)
with check (
  exists (
    select 1
    from public.group_auditions audition
    where audition.id = audition_id
      and public.is_scoped_group_admin(auth.uid(), audition.group_id)
  )
);

create policy "Group admins can delete group audition timeslots"
on public.group_audition_timeslots for delete
to authenticated
using (
  exists (
    select 1
    from public.group_auditions audition
    where audition.id = audition_id
      and public.is_scoped_group_admin(auth.uid(), audition.group_id)
  )
);

grant select, insert, update, delete on public.group_auditions to authenticated;
grant select, insert, update, delete on public.group_audition_timeslots to authenticated;

create or replace function public.create_group_audition(
  _group_id uuid,
  _title text,
  _description text,
  _materials text,
  _is_published boolean,
  _timeslots jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_audition_id uuid;
  slot jsonb;
  slot_starts_at timestamptz;
  slot_ends_at timestamptz;
  slot_capacity integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_scoped_group_admin(auth.uid(), _group_id) then
    raise exception 'Only a department admin can create auditions for this department';
  end if;

  if length(trim(coalesce(_title, ''))) = 0 then
    raise exception 'Audition title is required';
  end if;

  if jsonb_typeof(_timeslots) is distinct from 'array' or jsonb_array_length(_timeslots) = 0 then
    raise exception 'At least one timeslot is required';
  end if;

  insert into public.group_auditions (
    group_id,
    title,
    description,
    materials,
    is_published,
    created_by
  ) values (
    _group_id,
    trim(_title),
    trim(coalesce(_description, '')),
    trim(coalesce(_materials, '')),
    coalesce(_is_published, false),
    auth.uid()
  )
  returning id into new_audition_id;

  for slot in select value from jsonb_array_elements(_timeslots)
  loop
    slot_starts_at := nullif(slot ->> 'starts_at', '')::timestamptz;
    slot_ends_at := nullif(slot ->> 'ends_at', '')::timestamptz;
    slot_capacity := coalesce(nullif(slot ->> 'capacity', '')::integer, 1);

    if slot_starts_at is null or slot_ends_at is null or slot_ends_at <= slot_starts_at then
      raise exception 'Every timeslot must have a valid start and end time';
    end if;

    if slot_capacity < 1 then
      raise exception 'Timeslot capacity must be at least one';
    end if;

    insert into public.group_audition_timeslots (
      audition_id,
      starts_at,
      ends_at,
      capacity
    ) values (
      new_audition_id,
      slot_starts_at,
      slot_ends_at,
      slot_capacity
    );
  end loop;

  return new_audition_id;
end;
$$;

revoke all on function public.create_group_audition(uuid, text, text, text, boolean, jsonb) from public;
revoke all on function public.create_group_audition(uuid, text, text, text, boolean, jsonb) from anon;
grant execute on function public.create_group_audition(uuid, text, text, text, boolean, jsonb) to authenticated;
