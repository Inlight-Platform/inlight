drop policy if exists "Admins can delete companies" on public.companies;

create policy "Admins can delete companies"
  on public.companies for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

notify pgrst, 'reload schema';
