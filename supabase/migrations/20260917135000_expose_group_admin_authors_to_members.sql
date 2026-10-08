-- Active members need only admin user IDs to filter department history. Keep
-- group_admins management rows and invitation emails restricted to admins.
CREATE OR REPLACE FUNCTION public.get_group_active_admin_user_ids(_group_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_user_id
  FROM (
    SELECT ga.user_id AS admin_user_id
    FROM public.group_admins ga
    WHERE ga.group_id = _group_id
      AND ga.status = 'active'
      AND ga.user_id IS NOT NULL

    UNION

    SELECT g.faculty_owner_id AS admin_user_id
    FROM public.groups g
    WHERE g.id = _group_id
      AND g.faculty_owner_id IS NOT NULL
  ) admins
  WHERE auth.uid() IS NOT NULL
    AND (
      public.is_group_member(auth.uid(), _group_id)
      OR public.is_group_faculty(auth.uid(), _group_id)
    );
$$;

REVOKE ALL ON FUNCTION public.get_group_active_admin_user_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_active_admin_user_ids(uuid) TO authenticated;
