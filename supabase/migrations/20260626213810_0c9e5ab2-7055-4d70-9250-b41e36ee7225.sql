
-- 1. Tables
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  faculty_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO authenticated, anon;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups readable by everyone" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Faculty owner can update group" ON public.groups
  FOR UPDATE USING (faculty_owner_id = auth.uid()) WITH CHECK (faculty_owner_id = auth.uid());

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.post_groups (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, group_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_groups TO authenticated;
GRANT ALL ON public.post_groups TO service_role;
ALTER TABLE public.post_groups ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_user uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user AND group_id = _group AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_faculty(_user uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups WHERE id = _group AND faculty_owner_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_faculty_group()
RETURNS TABLE(id uuid, slug text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.slug, g.name FROM public.groups g
  WHERE g.faculty_owner_id = auth.uid()
  ORDER BY g.name LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_groups()
RETURNS TABLE(id uuid, slug text, name text, is_faculty boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.slug, g.name, (g.faculty_owner_id = auth.uid()) AS is_faculty
  FROM public.groups g
  WHERE g.faculty_owner_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.group_members gm
       WHERE gm.group_id = g.id AND gm.user_id = auth.uid() AND gm.status = 'active'
     );
$$;

-- 3. Group_members policies (use SECURITY DEFINER helpers)
CREATE POLICY "Members can view roster of their group" ON public.group_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_group_member(auth.uid(), group_id) OR public.is_group_faculty(auth.uid(), group_id));
CREATE POLICY "Faculty can add members" ON public.group_members FOR INSERT
  WITH CHECK (public.is_group_faculty(auth.uid(), group_id));
CREATE POLICY "Users can request to join" ON public.group_members FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Faculty can update memberships" ON public.group_members FOR UPDATE
  USING (public.is_group_faculty(auth.uid(), group_id)) WITH CHECK (public.is_group_faculty(auth.uid(), group_id));
CREATE POLICY "Faculty or user can remove membership" ON public.group_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_group_faculty(auth.uid(), group_id));

-- 4. post_groups policies
CREATE POLICY "Members can read post-group links" ON public.post_groups FOR SELECT
  USING (public.is_group_member(auth.uid(), group_id) OR public.is_group_faculty(auth.uid(), group_id));
CREATE POLICY "Owner can tag own post to a group they belong to" ON public.post_groups FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
    AND (public.is_group_member(auth.uid(), group_id) OR public.is_group_faculty(auth.uid(), group_id))
  );
CREATE POLICY "Owner or faculty can untag post" ON public.post_groups FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
    OR public.is_group_faculty(auth.uid(), group_id)
  );

-- 5. Allow group-scoped posts to be visible & faculty to moderate posts in their group
CREATE OR REPLACE FUNCTION public.can_view_post(post_row posts)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN post_row.visibility = 'public' THEN true
    WHEN post_row.user_id = auth.uid() THEN true
    WHEN post_row.visibility = 'network' THEN EXISTS (
      SELECT 1 FROM connections c1
      INNER JOIN connections c2 ON c1.follower_id = c2.following_id AND c1.following_id = c2.follower_id
      WHERE c1.follower_id = post_row.user_id AND c1.following_id = auth.uid()
    )
    WHEN post_row.visibility = 'specific' THEN EXISTS (
      SELECT 1 FROM post_recipients WHERE post_id = post_row.id AND recipient_id = auth.uid()
    )
    WHEN post_row.visibility = 'group' THEN EXISTS (
      SELECT 1 FROM post_groups pg
      WHERE pg.post_id = post_row.id
        AND (public.is_group_member(auth.uid(), pg.group_id) OR public.is_group_faculty(auth.uid(), pg.group_id))
    )
    ELSE false
  END
$$;

-- Allow faculty to delete posts tagged to their group
DROP POLICY IF EXISTS "Users can delete their own posts or admins can delete any" ON public.posts;
CREATE POLICY "Owner admin or faculty can delete post" ON public.posts FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.post_groups pg
      JOIN public.groups g ON g.id = pg.group_id
      WHERE pg.post_id = posts.id AND g.faculty_owner_id = auth.uid()
    )
  );

-- Allow faculty to flip visibility on posts in their group (public <-> group)
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Owner or faculty can update post" ON public.posts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.post_groups pg
      JOIN public.groups g ON g.id = pg.group_id
      WHERE pg.post_id = posts.id AND g.faculty_owner_id = auth.uid()
    )
  );

-- 6. Auto-join trigger by badge
CREATE OR REPLACE FUNCTION public.auto_join_strasberg_by_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _group_id uuid;
BEGIN
  SELECT id INTO _group_id FROM public.groups WHERE slug = 'strasberg';
  IF _group_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.badges IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(NEW.badges) b WHERE lower(b) = 'strasberg'
  ) THEN
    INSERT INTO public.group_members (group_id, user_id, status)
    VALUES (_group_id, NEW.user_id, 'active')
    ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS auto_join_strasberg_on_profile ON public.profiles;
CREATE TRIGGER auto_join_strasberg_on_profile
  AFTER INSERT OR UPDATE OF badges ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_join_strasberg_by_badge();

-- 7. Seed Strasberg group & backfill members
INSERT INTO public.groups (slug, name, description)
VALUES ('strasberg', 'Strasberg', 'A private space for the Strasberg cohort and faculty.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.group_members (group_id, user_id, status)
SELECT g.id, p.user_id, 'active'
FROM public.profiles p
CROSS JOIN public.groups g
WHERE g.slug = 'strasberg'
  AND p.badges IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(p.badges) b WHERE lower(b) = 'strasberg')
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 8. Create demo faculty auth user for Annie (819annietmail@gmail.com / @Anniet819) and grant ownership
DO $$
DECLARE
  _new_user_id uuid;
  _strasberg_id uuid;
  _existing_annie_id uuid := '01e6a49d-1453-4c9c-84a4-94ebfe8cbea4';
BEGIN
  SELECT id INTO _strasberg_id FROM public.groups WHERE slug = 'strasberg';

  -- Create demo gmail account if absent
  SELECT id INTO _new_user_id FROM auth.users WHERE lower(email) = '819annietmail@gmail.com';
  IF _new_user_id IS NULL THEN
    _new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      _new_user_id,
      'authenticated', 'authenticated',
      '819annietmail@gmail.com',
      crypt('@Anniet819', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name','Annie Thomas (Faculty)'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _new_user_id,
      jsonb_build_object('sub', _new_user_id::text, 'email', '819annietmail@gmail.com'),
      'email', _new_user_id::text, now(), now(), now());
  END IF;

  -- Make sure profile row exists (handle_new_user trigger usually does this, but be safe)
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (_new_user_id, '819annietmail@gmail.com', 'Annie Thomas (Faculty)')
  ON CONFLICT (user_id) DO NOTHING;

  -- Make the demo gmail account the Strasberg faculty owner
  UPDATE public.groups SET faculty_owner_id = _new_user_id WHERE id = _strasberg_id;

  -- Also grant the real Annie account faculty access so either login works
  -- (handled by making both group_members + adding a co-owner flag — for demo we keep single owner)
  -- Add Annie's existing student account as active member so she still sees the feed
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _existing_annie_id) THEN
    INSERT INTO public.group_members (group_id, user_id, status)
    VALUES (_strasberg_id, _existing_annie_id, 'active')
    ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';
  END IF;
END $$;

-- updated_at trigger on groups
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
