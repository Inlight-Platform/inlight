-- Policy helpers must be callable without exposing other users' private affiliations.
CREATE OR REPLACE FUNCTION public.is_group_member(_user uuid, _group uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user IS NULL OR _group IS NULL THEN
    RETURN false;
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user AND group_id = _group AND status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_group_faculty(_user uuid, _group uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF _user IS NULL OR _group IS NULL THEN
    RETURN false;
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user) THEN
    RETURN false;
  END IF;
  IF public.has_role(_user, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _user;
  RETURN EXISTS (
    SELECT 1 FROM public.group_admins ga
    WHERE ga.group_id = _group AND ga.status = 'active'
      AND (ga.user_id = _user
        OR (ga.email IS NOT NULL AND _email IS NOT NULL AND lower(ga.email) = _email))
  ) OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group AND g.faculty_owner_id = _user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_group_faculty(uuid, uuid) FROM PUBLIC;
-- Anonymous policies can evaluate these safely: anonymous checks always return false.
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_faculty(uuid, uuid) TO anon, authenticated, service_role;

ALTER POLICY "Groups visible by directory or membership" ON public.groups
USING (
  CASE WHEN auth.uid() IS NULL THEN is_listed
  ELSE is_listed
    OR public.is_group_member(auth.uid(), id)
    OR public.is_scoped_group_admin(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  END
);

NOTIFY pgrst, 'reload schema';
