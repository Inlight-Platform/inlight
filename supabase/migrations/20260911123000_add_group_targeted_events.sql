-- Allow events to be targeted to a private group.

alter table public.events
  drop constraint if exists events_visibility_check;

alter table public.events
  add constraint events_visibility_check
  check (visibility in ('public', 'network', 'specific', 'group', 'unlisted'));

create table if not exists public.event_groups (
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, group_id)
);

grant select, insert, delete on public.event_groups to authenticated;
grant all on public.event_groups to service_role;

alter table public.event_groups enable row level security;

drop policy if exists "Members can read event-group links" on public.event_groups;
create policy "Members can read event-group links"
on public.event_groups for select
using (
  public.is_group_member(auth.uid(), group_id)
  or public.is_group_faculty(auth.uid(), group_id)
);

drop policy if exists "Owner can tag own event to a group they belong to" on public.event_groups;
create policy "Owner can tag own event to a group they belong to"
on public.event_groups for insert
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.user_id = auth.uid()
  )
  and (
    public.is_group_member(auth.uid(), group_id)
    or public.is_group_faculty(auth.uid(), group_id)
  )
);

drop policy if exists "Owner or faculty can untag event" on public.event_groups;
create policy "Owner or faculty can untag event"
on public.event_groups for delete
using (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.user_id = auth.uid()
  )
  or public.is_group_faculty(auth.uid(), group_id)
);

create or replace function public.can_view_event(event_row public.events)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when event_row.visibility = 'public' then true
    when event_row.visibility = 'unlisted' then true
    when event_row.user_id = auth.uid() then true
    when public.has_role(auth.uid(), 'admin') then true
    when event_row.visibility = 'network' then exists (
      select 1 from connections c1
      inner join connections c2
        on c1.follower_id = c2.following_id
        and c1.following_id = c2.follower_id
      where c1.follower_id = event_row.user_id
        and c1.following_id = auth.uid()
    )
    when event_row.visibility = 'specific' then exists (
      select 1 from event_recipients
      where event_id = event_row.id
        and recipient_id = auth.uid()
    )
    when event_row.visibility = 'group' then exists (
      select 1 from public.event_groups eg
      where eg.event_id = event_row.id
        and (
          public.is_group_member(auth.uid(), eg.group_id)
          or public.is_group_faculty(auth.uid(), eg.group_id)
        )
    )
    else false
  end
$$;

create index if not exists event_groups_group_id_idx
  on public.event_groups(group_id);

create index if not exists event_groups_event_id_idx
  on public.event_groups(event_id);

notify pgrst, 'reload schema';
