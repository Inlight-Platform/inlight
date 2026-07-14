-- The approve-company-account Edge Function calls this RPC with the service role.
-- Keep it unavailable to browser clients while allowing the trusted backend path.
revoke all on function public.finalize_company_account_approval(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.finalize_company_account_approval(uuid, uuid, text)
  to service_role;
