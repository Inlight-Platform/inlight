CREATE OR REPLACE FUNCTION public.get_company_requester_profiles(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.email, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_company_requester_profiles(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
