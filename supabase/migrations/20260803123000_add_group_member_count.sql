CREATE OR REPLACE FUNCTION public.get_group_active_member_count(_group_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.group_members
  WHERE group_id = _group_id
    AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.get_group_active_member_count(uuid) TO anon, authenticated;
