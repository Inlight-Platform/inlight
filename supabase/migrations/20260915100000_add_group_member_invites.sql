create extension if not exists pgcrypto with schema extensions;

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  token text not null default encode(gen_random_bytes(24), 'hex'),
  personal_note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  membership_status_on_accept text not null default 'active' check (membership_status_on_accept in ('active', 'pending')),
  platform_invite_id uuid references public.platform_invites(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_invites_token_key
  on public.group_invites(token);

create unique index if not exists group_invites_open_group_email_key
  on public.group_invites(group_id, lower(email))
  where status in ('pending', 'accepted');

create index if not exists group_invites_group_created_idx
  on public.group_invites(group_id, created_at desc);

create index if not exists group_invites_email_status_idx
  on public.group_invites(lower(email), status);

alter table public.group_invites enable row level security;

drop policy if exists "Scoped group admins can view group invites" on public.group_invites;
create policy "Scoped group admins can view group invites"
on public.group_invites for select
using (public.is_scoped_group_admin(auth.uid(), group_id));

drop policy if exists "Scoped group admins can create group invites" on public.group_invites;
create policy "Scoped group admins can create group invites"
on public.group_invites for insert
with check (
  invited_by = auth.uid()
  and public.is_scoped_group_admin(auth.uid(), group_id)
);

drop policy if exists "Scoped group admins can update group invites" on public.group_invites;
create policy "Scoped group admins can update group invites"
on public.group_invites for update
using (public.is_scoped_group_admin(auth.uid(), group_id))
with check (public.is_scoped_group_admin(auth.uid(), group_id));

drop policy if exists "Scoped group admins can delete group invites" on public.group_invites;
create policy "Scoped group admins can delete group invites"
on public.group_invites for delete
using (public.is_scoped_group_admin(auth.uid(), group_id));

grant select, insert, update, delete on public.group_invites to authenticated;
grant all on public.group_invites to service_role;

drop trigger if exists set_group_invites_updated_at on public.group_invites;
create trigger set_group_invites_updated_at
  before update on public.group_invites
  for each row
  execute function public.update_updated_at_column();

notify pgrst, 'reload schema';
