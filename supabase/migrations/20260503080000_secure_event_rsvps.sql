-- Restrict raw RSVP rows and expose a safe public attendee feed without emails.

drop policy if exists "RSVPs are publicly viewable" on public.event_rsvps;

create policy "Users can view their own RSVP"
on public.event_rsvps
for select
to authenticated
using (auth.uid() = user_id);

create policy "Event creators and admins can view RSVPs for their events"
on public.event_rsvps
for select
to authenticated
using (
  auth.uid() in (
    select events.user_id
    from public.events
    where events.id = event_rsvps.event_id
  )
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

create or replace function public.get_public_event_rsvps(target_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  name text,
  role_type text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.event_id,
    r.user_id,
    r.name,
    r.role_type,
    r.status,
    r.created_at
  from public.event_rsvps r
  where r.event_id = target_event_id
  order by r.created_at asc
$$;

grant execute on function public.get_public_event_rsvps(uuid) to anon, authenticated;
