create or replace function public.check_email_exists_for_signup(search_email text)
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select case
    when nullif(btrim(search_email), '') is null then false
    else exists (
      select 1
      from auth.users
      where lower(email) = lower(btrim(search_email))
    )
  end;
$$;

revoke all on function public.check_email_exists_for_signup(text) from public;
grant execute on function public.check_email_exists_for_signup(text) to anon, authenticated;
