CREATE TABLE IF NOT EXISTS public.group_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_admins_identity_check CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS group_admins_group_user_key
  ON public.group_admins(group_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS group_admins_group_email_key
  ON public.group_admins(group_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS group_admins_group_status_idx
  ON public.group_admins(group_id, status);

GRANT SELECT ON public.group_admins TO authenticated;
GRANT ALL ON public.group_admins TO service_role;
ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.group_admins (group_id, user_id, email, status, role)
SELECT g.id, g.faculty_owner_id, u.email, 'active', 'admin'
FROM public.groups g
LEFT JOIN auth.users u ON u.id = g.faculty_owner_id
WHERE g.faculty_owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_group_faculty(_user uuid, _group uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF _user IS NULL OR _group IS NULL THEN
    RETURN false;
  END IF;

  SELECT lower(email) INTO _email
  FROM auth.users
  WHERE id = _user;

  RETURN EXISTS (
    SELECT 1
    FROM public.group_admins ga
    WHERE ga.group_id = _group
      AND ga.status = 'active'
      AND (
        ga.user_id = _user
        OR (ga.email IS NOT NULL AND _email IS NOT NULL AND lower(ga.email) = _email)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = _group
      AND g.faculty_owner_id = _user
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_faculty_group()
RETURNS TABLE(id uuid, slug text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.slug, g.name
  FROM public.groups g
  WHERE public.is_group_faculty(auth.uid(), g.id)
  ORDER BY g.name
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_groups()
RETURNS TABLE(id uuid, slug text, name text, is_faculty boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.slug, g.name, public.is_group_faculty(auth.uid(), g.id) AS is_faculty
  FROM public.groups g
  WHERE public.is_group_faculty(auth.uid(), g.id)
     OR EXISTS (
       SELECT 1
       FROM public.group_members gm
       WHERE gm.group_id = g.id
         AND gm.user_id = auth.uid()
         AND gm.status = 'active'
     )
  ORDER BY g.name;
$$;

DROP POLICY IF EXISTS "Group admins can view group admins" ON public.group_admins;
CREATE POLICY "Group admins can view group admins"
ON public.group_admins FOR SELECT
USING (
  public.is_group_faculty(auth.uid(), group_id)
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Faculty owner can update group" ON public.groups;
DROP POLICY IF EXISTS "Group admins can update group" ON public.groups;
CREATE POLICY "Group admins can update group"
ON public.groups FOR UPDATE
USING (public.is_group_faculty(auth.uid(), id))
WITH CHECK (public.is_group_faculty(auth.uid(), id));

DROP POLICY IF EXISTS "Owner admin or faculty can delete post" ON public.posts;
CREATE POLICY "Owner admin or faculty can delete post"
ON public.posts FOR DELETE
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.post_groups pg
    WHERE pg.post_id = posts.id
      AND public.is_group_faculty(auth.uid(), pg.group_id)
  )
);

DROP POLICY IF EXISTS "Owner or faculty can update post" ON public.posts;
CREATE POLICY "Owner or faculty can update post"
ON public.posts FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.post_groups pg
    WHERE pg.post_id = posts.id
      AND public.is_group_faculty(auth.uid(), pg.group_id)
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.post_groups pg
    WHERE pg.post_id = posts.id
      AND public.is_group_faculty(auth.uid(), pg.group_id)
  )
);

CREATE OR REPLACE FUNCTION public.add_group_admin_by_email(_group_id uuid, _email text)
RETURNS public.group_admins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := lower(trim(_email));
  target_user_id uuid;
  admin_row public.group_admins%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_group_faculty(auth.uid(), _group_id) THEN
    RAISE EXCEPTION 'Not authorized to manage group admins';
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' OR normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = normalized_email
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT * INTO admin_row
  FROM public.group_admins
  WHERE group_id = _group_id
    AND lower(email) = normalized_email
  LIMIT 1;

  IF admin_row.id IS NOT NULL THEN
    UPDATE public.group_admins
       SET user_id = COALESCE(target_user_id, user_id),
           email = normalized_email,
           status = 'active',
           updated_at = now()
     WHERE id = admin_row.id
     RETURNING * INTO admin_row;
    RETURN admin_row;
  END IF;

  IF target_user_id IS NOT NULL THEN
    SELECT * INTO admin_row
    FROM public.group_admins
    WHERE group_id = _group_id
      AND user_id = target_user_id
    LIMIT 1;

    IF admin_row.id IS NOT NULL THEN
      UPDATE public.group_admins
         SET email = normalized_email,
             status = 'active',
             updated_at = now()
       WHERE id = admin_row.id
       RETURNING * INTO admin_row;
      RETURN admin_row;
    END IF;
  END IF;

  INSERT INTO public.group_admins (group_id, user_id, email, status, role, invited_by)
  VALUES (_group_id, target_user_id, normalized_email, 'active', 'admin', auth.uid())
  RETURNING * INTO admin_row;

  RETURN admin_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_admin(_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_row public.group_admins%rowtype;
  remaining_count integer;
BEGIN
  SELECT * INTO admin_row
  FROM public.group_admins
  WHERE id = _admin_id;

  IF admin_row.id IS NULL THEN
    RAISE EXCEPTION 'Group admin not found';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_group_faculty(auth.uid(), admin_row.group_id) THEN
    RAISE EXCEPTION 'Not authorized to manage group admins';
  END IF;

  SELECT count(*) INTO remaining_count
  FROM public.group_admins
  WHERE group_id = admin_row.group_id
    AND status = 'active'
    AND id <> admin_row.id;

  IF remaining_count < 1 THEN
    RAISE EXCEPTION 'A group must have at least one active admin';
  END IF;

  DELETE FROM public.group_admins
  WHERE id = admin_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_group_admin_by_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_admin(uuid) TO authenticated;

DROP TRIGGER IF EXISTS group_admins_updated_at ON public.group_admins;
CREATE TRIGGER group_admins_updated_at
  BEFORE UPDATE ON public.group_admins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
