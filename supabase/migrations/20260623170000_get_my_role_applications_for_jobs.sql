create or replace function public.get_my_role_applications_for_jobs()
returns table (
  id uuid,
  project_role_id uuid,
  project_id uuid,
  role_name text,
  project_title text,
  message text,
  reel_url text,
  resume_url text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ra.id,
    ra.project_role_id,
    pr.project_id,
    pr.role_name,
    p.title as project_title,
    ra.message,
    ra.reel_url,
    ra.resume_url,
    ra.status,
    ra.created_at
  from public.role_applications ra
  join public.project_roles pr on pr.id = ra.project_role_id
  join public.projects p on p.id = pr.project_id
  where ra.applicant_id = auth.uid()
  order by ra.created_at desc
$$;

grant execute on function public.get_my_role_applications_for_jobs() to authenticated;
