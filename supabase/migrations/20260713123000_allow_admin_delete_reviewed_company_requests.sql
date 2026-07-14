grant delete on public.company_account_requests to authenticated;

drop policy if exists "Admins can delete reviewed company requests"
  on public.company_account_requests;

create policy "Admins can delete reviewed company requests"
  on public.company_account_requests
  for delete
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and status <> 'pending'
  );
