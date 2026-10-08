BEGIN;

-- INV96 Group 9: project child records require authentication. Public project
-- metadata remains available through the Group 5 browse projection.
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.can_access_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND (
        COALESCE(p.is_public, false)
        OR p.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
        )
        OR private.is_invited_to_project(p.id)
        OR private.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
$$;

DROP POLICY IF EXISTS "Project creator or member themselves can remove membership" ON public.project_members;
DROP POLICY IF EXISTS "Project creator can add members" ON public.project_members;
DROP POLICY IF EXISTS "Anyone can view members of public company-linked projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can view members for accessible projects" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated users can view members for accessible projects" ON public.project_members;
DROP POLICY IF EXISTS "Project owners and admins can add members" ON public.project_members;
DROP POLICY IF EXISTS "Members can leave and project owners or admins can remove members" ON public.project_members;

CREATE POLICY "Authenticated users can view members for accessible projects"
ON public.project_members FOR SELECT TO authenticated
USING (public.can_access_project(project_id));
CREATE POLICY "Project owners and admins can add members"
ON public.project_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND (
        p.creator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);
CREATE POLICY "Members can leave and project owners or admins can remove members"
ON public.project_members FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND (
        p.creator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

DROP POLICY IF EXISTS "Photo owner or project creator can delete photos" ON public.project_photos;
DROP POLICY IF EXISTS "Project members can add photos" ON public.project_photos;
DROP POLICY IF EXISTS "Users can view photos for accessible projects" ON public.project_photos;
DROP POLICY IF EXISTS "Authenticated users can view photos for accessible projects" ON public.project_photos;
DROP POLICY IF EXISTS "Project members owners and admins can add photos" ON public.project_photos;
DROP POLICY IF EXISTS "Photo owners project creators and admins can update photos" ON public.project_photos;
DROP POLICY IF EXISTS "Photo owners project creators and admins can delete photos" ON public.project_photos;

CREATE POLICY "Authenticated users can view photos for accessible projects"
ON public.project_photos FOR SELECT TO authenticated
USING (public.can_access_project(project_id));
CREATE POLICY "Project members owners and admins can add photos"
ON public.project_photos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_photos.project_id
        AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_photos.project_id
        AND pm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
CREATE POLICY "Photo owners project creators and admins can update photos"
ON public.project_photos FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_photos.project_id
      AND p.creator_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_photos.project_id
      AND p.creator_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
CREATE POLICY "Photo owners project creators and admins can delete photos"
ON public.project_photos FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_photos.project_id
      AND p.creator_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Project creator can delete roles" ON public.project_roles;
DROP POLICY IF EXISTS "Project creator can manage roles" ON public.project_roles;
DROP POLICY IF EXISTS "Project creator can update roles" ON public.project_roles;
DROP POLICY IF EXISTS "Anyone can view roles of public company-linked projects" ON public.project_roles;
DROP POLICY IF EXISTS "Users can view roles for accessible projects" ON public.project_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles for accessible projects" ON public.project_roles;
DROP POLICY IF EXISTS "Project owners and admins can add roles" ON public.project_roles;
DROP POLICY IF EXISTS "Project owners and admins can update roles" ON public.project_roles;
DROP POLICY IF EXISTS "Project owners and admins can delete roles" ON public.project_roles;

CREATE POLICY "Authenticated users can view roles for accessible projects"
ON public.project_roles FOR SELECT TO authenticated
USING (public.can_access_project(project_id));
CREATE POLICY "Project owners and admins can add roles"
ON public.project_roles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_roles.project_id
      AND (
        p.creator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);
CREATE POLICY "Project owners and admins can update roles"
ON public.project_roles FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_roles.project_id
      AND (
        p.creator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_roles.project_id
      AND (
        p.creator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);
CREATE POLICY "Project owners and admins can delete roles"
ON public.project_roles FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_roles.project_id
      AND (
        p.creator_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

DROP POLICY IF EXISTS "Link owners or project creators can delete links" ON public.project_links;
DROP POLICY IF EXISTS "Project members can add links" ON public.project_links;
DROP POLICY IF EXISTS "Users can view links for accessible projects" ON public.project_links;
DROP POLICY IF EXISTS "Link owners or project creators can update links" ON public.project_links;
DROP POLICY IF EXISTS "Authenticated users can view links for accessible projects" ON public.project_links;
DROP POLICY IF EXISTS "Project members owners and admins can add links" ON public.project_links;
DROP POLICY IF EXISTS "Link owners project creators and admins can update links" ON public.project_links;
DROP POLICY IF EXISTS "Link owners project creators and admins can delete links" ON public.project_links;

CREATE POLICY "Authenticated users can view links for accessible projects"
ON public.project_links FOR SELECT TO authenticated
USING (public.can_access_project(project_id));
CREATE POLICY "Project members owners and admins can add links"
ON public.project_links FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_links.project_id
        AND p.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_links.project_id
        AND pm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
CREATE POLICY "Link owners project creators and admins can update links"
ON public.project_links FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_links.project_id
      AND p.creator_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_links.project_id
      AND p.creator_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
CREATE POLICY "Link owners project creators and admins can delete links"
ON public.project_links FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_links.project_id
      AND p.creator_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.add_project_member_by_email(
  target_project_id uuid,
  target_email text,
  target_role text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = target_project_id
      AND creator_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the project creator or an admin can add members';
  END IF;

  SELECT user_id INTO resolved_user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(target_email))
  LIMIT 1;

  IF resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (target_project_id, resolved_user_id, nullif(trim(target_role), ''))
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role;
END;
$$;

DROP POLICY IF EXISTS "Admins can delete any project" ON public.projects;
DROP POLICY IF EXISTS "Creator can delete their projects" ON public.projects;
CREATE POLICY "Admins can delete any project"
ON public.projects FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Creator can delete their projects"
ON public.projects FOR DELETE TO authenticated
USING (auth.uid() = creator_id);

REVOKE ALL ON public.project_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_photos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_links FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, DELETE ON public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_links TO authenticated;

REVOKE ALL ON FUNCTION public.add_project_member_by_email(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_member_by_email(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

CREATE OR REPLACE FUNCTION private.can_access_project(target_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = target_project_id
      AND (
        COALESCE(p.is_public, false)
        OR p.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR private.is_invited_to_project(p.id)
      )
  )
$$;

DROP POLICY IF EXISTS "Authenticated users can view members for accessible projects" ON public.project_members;
DROP POLICY IF EXISTS "Project owners and admins can add members" ON public.project_members;
DROP POLICY IF EXISTS "Members can leave and project owners or admins can remove members" ON public.project_members;
CREATE POLICY "Users can view members for accessible projects" ON public.project_members FOR SELECT TO PUBLIC USING (public.can_access_project(project_id));
CREATE POLICY "Anyone can view members of public company-linked projects" ON public.project_members FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.company_id IS NOT NULL AND COALESCE(p.is_public, false)));
CREATE POLICY "Project creator can add members" ON public.project_members FOR INSERT TO PUBLIC WITH CHECK (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_members.project_id));
CREATE POLICY "Project creator or member themselves can remove membership" ON public.project_members FOR DELETE TO PUBLIC USING (auth.uid() = user_id OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_members.project_id));

DROP POLICY IF EXISTS "Authenticated users can view photos for accessible projects" ON public.project_photos;
DROP POLICY IF EXISTS "Project members owners and admins can add photos" ON public.project_photos;
DROP POLICY IF EXISTS "Photo owners project creators and admins can update photos" ON public.project_photos;
DROP POLICY IF EXISTS "Photo owners project creators and admins can delete photos" ON public.project_photos;
CREATE POLICY "Users can view photos for accessible projects" ON public.project_photos FOR SELECT TO PUBLIC USING (public.can_access_project(project_id));
CREATE POLICY "Project members can add photos" ON public.project_photos FOR INSERT TO PUBLIC WITH CHECK (auth.uid() IN (SELECT user_id FROM public.project_members WHERE project_id = project_photos.project_id) OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_photos.project_id));
CREATE POLICY "Photo owner or project creator can delete photos" ON public.project_photos FOR DELETE TO PUBLIC USING (auth.uid() = user_id OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_photos.project_id));

DROP POLICY IF EXISTS "Authenticated users can view roles for accessible projects" ON public.project_roles;
DROP POLICY IF EXISTS "Project owners and admins can add roles" ON public.project_roles;
DROP POLICY IF EXISTS "Project owners and admins can update roles" ON public.project_roles;
DROP POLICY IF EXISTS "Project owners and admins can delete roles" ON public.project_roles;
CREATE POLICY "Users can view roles for accessible projects" ON public.project_roles FOR SELECT TO PUBLIC USING (public.can_access_project(project_id));
CREATE POLICY "Anyone can view roles of public company-linked projects" ON public.project_roles FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_roles.project_id AND p.company_id IS NOT NULL AND COALESCE(p.is_public, false)));
CREATE POLICY "Project creator can manage roles" ON public.project_roles FOR INSERT TO PUBLIC WITH CHECK (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_roles.project_id));
CREATE POLICY "Project creator can update roles" ON public.project_roles FOR UPDATE TO PUBLIC USING (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_roles.project_id));
CREATE POLICY "Project creator can delete roles" ON public.project_roles FOR DELETE TO PUBLIC USING (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_roles.project_id));

DROP POLICY IF EXISTS "Authenticated users can view links for accessible projects" ON public.project_links;
DROP POLICY IF EXISTS "Project members owners and admins can add links" ON public.project_links;
DROP POLICY IF EXISTS "Link owners project creators and admins can update links" ON public.project_links;
DROP POLICY IF EXISTS "Link owners project creators and admins can delete links" ON public.project_links;
CREATE POLICY "Users can view links for accessible projects" ON public.project_links FOR SELECT TO PUBLIC USING (public.can_access_project(project_id));
CREATE POLICY "Project members can add links" ON public.project_links FOR INSERT TO PUBLIC WITH CHECK (auth.uid() = user_id AND (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_links.project_id AND p.creator_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_links.project_id AND pm.user_id = auth.uid())));
CREATE POLICY "Link owners or project creators can update links" ON public.project_links FOR UPDATE TO PUBLIC USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_links.project_id AND p.creator_id = auth.uid()) OR (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_links.project_id AND pm.user_id = auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_links.project_id AND p.creator_id = auth.uid()) OR (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_links.project_id AND pm.user_id = auth.uid())));
CREATE POLICY "Link owners or project creators can delete links" ON public.project_links FOR DELETE TO PUBLIC USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_links.project_id AND p.creator_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.add_project_member_by_email(target_project_id uuid, target_email text, target_role text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE resolved_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = target_project_id AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the project creator can add members';
  END IF;
  SELECT user_id INTO resolved_user_id FROM public.profiles WHERE lower(email) = lower(trim(target_email)) LIMIT 1;
  IF resolved_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (target_project_id, resolved_user_id, nullif(trim(target_role), ''))
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role;
END;
$$;

DROP POLICY IF EXISTS "Admins can delete any project" ON public.projects;
DROP POLICY IF EXISTS "Creator can delete their projects" ON public.projects;
CREATE POLICY "Admins can delete any project" ON public.projects FOR DELETE TO PUBLIC USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Creator can delete their projects" ON public.projects FOR DELETE TO PUBLIC USING (auth.uid() = creator_id);

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.project_members, public.project_photos, public.project_roles, public.project_links TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_member_by_email(uuid, text, text) TO PUBLIC;

NOTIFY pgrst, 'reload schema';
COMMIT;
*/
