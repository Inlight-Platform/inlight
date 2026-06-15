-- Backfill sender-side verified credits for project-credit invites accepted before sender verification existed.

with accepted_invites as (
  select
    pci.inviter_id,
    p.title as project_title,
    case
      when p.creator_id = pci.inviter_id then 'Project Creator'
      else coalesce(nullif(btrim(pm.role), ''), 'Collaborator')
    end as sender_role,
    extract(year from coalesce(p.start_date::timestamptz, p.created_at, now()))::integer as credit_year
  from public.project_credit_invites pci
  join public.projects p on p.id = pci.project_id
  left join public.project_members pm
    on pm.project_id = pci.project_id
   and pm.user_id = pci.inviter_id
  where pci.status = 'accepted'
),
deduped_sender_credits as (
  select distinct on (inviter_id, lower(project_title))
    inviter_id,
    project_title,
    sender_role,
    credit_year
  from accepted_invites
  order by inviter_id, lower(project_title), sender_role
),
updated_existing as (
  update public.credits c
     set verified = true,
         updated_at = now()
    from deduped_sender_credits d
   where c.user_id = d.inviter_id
     and lower(c.project) = lower(d.project_title)
     and c.verified = false
  returning c.id
)
insert into public.credits (user_id, project, role, year, verified)
select
  d.inviter_id,
  d.project_title,
  d.sender_role,
  d.credit_year,
  true
from deduped_sender_credits d
where not exists (
  select 1
  from public.credits c
  where c.user_id = d.inviter_id
    and lower(c.project) = lower(d.project_title)
);
