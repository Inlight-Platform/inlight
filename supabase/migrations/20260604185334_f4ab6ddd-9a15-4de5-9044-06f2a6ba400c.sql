
-- 1. Referral column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 2. General platform invites
CREATE TABLE IF NOT EXISTS public.platform_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL,
  email text NOT NULL,
  personal_note text,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_invites_email ON public.platform_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_platform_invites_inviter ON public.platform_invites(inviter_id);

GRANT SELECT, INSERT, UPDATE ON public.platform_invites TO authenticated;
GRANT ALL ON public.platform_invites TO service_role;
ALTER TABLE public.platform_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inviter can view their invites" ON public.platform_invites
  FOR SELECT TO authenticated USING (auth.uid() = inviter_id);
CREATE POLICY "Users can create invites" ON public.platform_invites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);

-- 3. Project credit invites
CREATE TABLE IF NOT EXISTS public.project_credit_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  email text NOT NULL,
  role_name text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pci_email ON public.project_credit_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_pci_project ON public.project_credit_invites(project_id);

GRANT SELECT, INSERT, UPDATE ON public.project_credit_invites TO authenticated;
GRANT ALL ON public.project_credit_invites TO service_role;
ALTER TABLE public.project_credit_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project creator can view invites" ON public.project_credit_invites
  FOR SELECT TO authenticated USING (
    auth.uid() = inviter_id OR
    auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_id)
  );
CREATE POLICY "Project creator can create invites" ON public.project_credit_invites
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = inviter_id AND
    auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_id)
  );

CREATE TRIGGER trg_pci_updated_at BEFORE UPDATE ON public.project_credit_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RPC: create general platform invite
CREATE OR REPLACE FUNCTION public.create_platform_invite(_email text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inviter uuid := auth.uid();
  _inviter_name text;
  _existing_user uuid;
  _invite_id uuid;
  _token uuid;
BEGIN
  IF _inviter IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF _email IS NULL OR position('@' in _email) = 0 THEN RAISE EXCEPTION 'Invalid email'; END IF;

  SELECT COALESCE(display_name, email) INTO _inviter_name
  FROM public.profiles WHERE user_id = _inviter;

  SELECT user_id INTO _existing_user
  FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1;

  INSERT INTO public.platform_invites (inviter_id, email, personal_note)
  VALUES (_inviter, lower(trim(_email)), _note)
  RETURNING id, token INTO _invite_id, _token;

  IF _existing_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      _existing_user,
      'platform_invite',
      'Invitation from ' || COALESCE(_inviter_name, 'a member'),
      COALESCE(_inviter_name, 'Someone') || ' invited you to join Inlight' || CASE WHEN _note IS NOT NULL AND length(_note) > 0 THEN ': ' || _note ELSE '' END,
      jsonb_build_object('invite_id', _invite_id, 'inviter_id', _inviter)
    );
  END IF;

  RETURN jsonb_build_object(
    'invite_id', _invite_id,
    'token', _token,
    'existing_user_id', _existing_user,
    'inviter_name', _inviter_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_platform_invite(text, text) TO authenticated;

-- 5. RPC: create project credit invite
CREATE OR REPLACE FUNCTION public.create_project_credit_invite(_project_id uuid, _email text, _role_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inviter uuid := auth.uid();
  _inviter_name text;
  _project_title text;
  _existing_user uuid;
  _invite_id uuid;
  _token uuid;
BEGIN
  IF _inviter IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF _email IS NULL OR position('@' in _email) = 0 THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF _role_name IS NULL OR length(trim(_role_name)) = 0 THEN RAISE EXCEPTION 'Role required'; END IF;

  SELECT title INTO _project_title FROM public.projects
   WHERE id = _project_id AND creator_id = _inviter;
  IF _project_title IS NULL THEN RAISE EXCEPTION 'Only the project creator can invite collaborators'; END IF;

  SELECT COALESCE(display_name, email) INTO _inviter_name
  FROM public.profiles WHERE user_id = _inviter;

  SELECT user_id INTO _existing_user
  FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1;

  INSERT INTO public.project_credit_invites (project_id, inviter_id, email, role_name)
  VALUES (_project_id, _inviter, lower(trim(_email)), trim(_role_name))
  RETURNING id, token INTO _invite_id, _token;

  IF _existing_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      _existing_user,
      'project_credit_invite',
      'Credit invitation: ' || _project_title,
      'You''ve been invited to ' || _project_title || ' to claim your credit as ' || trim(_role_name) || '.',
      jsonb_build_object(
        'invite_id', _invite_id,
        'token', _token,
        'project_id', _project_id,
        'project_title', _project_title,
        'role_name', trim(_role_name),
        'inviter_id', _inviter
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'invite_id', _invite_id,
    'token', _token,
    'existing_user_id', _existing_user,
    'inviter_name', _inviter_name,
    'project_title', _project_title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_credit_invite(uuid, text, text) TO authenticated;

-- 6. RPC: accept project credit invite (existing user clicks accept)
CREATE OR REPLACE FUNCTION public.accept_project_credit_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _invite RECORD;
  _project RECORD;
  _user_name text;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  SELECT * INTO _invite FROM public.project_credit_invites
   WHERE token = _token AND status = 'pending' LIMIT 1;
  IF _invite IS NULL THEN RAISE EXCEPTION 'Invitation not found or already used'; END IF;

  SELECT * INTO _project FROM public.projects WHERE id = _invite.project_id;
  IF _project IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;

  -- Insert credit
  INSERT INTO public.credits (user_id, project, role, year, company, verified)
  VALUES (
    _user,
    _project.title,
    _invite.role_name,
    COALESCE(EXTRACT(YEAR FROM _project.start_date)::int, EXTRACT(YEAR FROM now())::int),
    NULL,
    false
  );

  -- Add as project member if not already
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_invite.project_id, _user, _invite.role_name)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Mark invite accepted
  UPDATE public.project_credit_invites
     SET status = 'accepted', accepted_by = _user, accepted_at = now(), updated_at = now()
   WHERE id = _invite.id;

  -- Notify inviter
  SELECT COALESCE(display_name, email) INTO _user_name FROM public.profiles WHERE user_id = _user;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _invite.inviter_id,
    'project_credit_invite_accepted',
    'Credit invitation accepted',
    COALESCE(_user_name, 'Someone') || ' accepted your credit invitation for ' || _project.title,
    jsonb_build_object('project_id', _invite.project_id, 'user_id', _user, 'role_name', _invite.role_name)
  );

  RETURN jsonb_build_object('ok', true, 'project_id', _invite.project_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_project_credit_invite(uuid) TO authenticated;

-- 7. RPC: claim invites on signup (sets referred_by, accepts pending invites by email)
CREATE OR REPLACE FUNCTION public.claim_invites_on_signup(_platform_token uuid DEFAULT NULL, _credit_token uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _email text;
  _platform RECORD;
  _credit RECORD;
  _referrer uuid;
  _project_title text;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  SELECT email INTO _email FROM public.profiles WHERE user_id = _user;

  -- Try platform invite (by token, or by email match)
  IF _platform_token IS NOT NULL THEN
    SELECT * INTO _platform FROM public.platform_invites
     WHERE token = _platform_token AND accepted_at IS NULL LIMIT 1;
  END IF;
  IF _platform IS NULL AND _email IS NOT NULL THEN
    SELECT * INTO _platform FROM public.platform_invites
     WHERE lower(email) = lower(_email) AND accepted_at IS NULL
     ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF _platform IS NOT NULL THEN
    UPDATE public.platform_invites
       SET accepted_by = _user, accepted_at = now()
     WHERE id = _platform.id;
    _referrer := _platform.inviter_id;
  END IF;

  -- Project credit invite
  IF _credit_token IS NOT NULL THEN
    SELECT * INTO _credit FROM public.project_credit_invites
     WHERE token = _credit_token AND status = 'pending' LIMIT 1;
  END IF;
  IF _credit IS NULL AND _email IS NOT NULL THEN
    SELECT * INTO _credit FROM public.project_credit_invites
     WHERE lower(email) = lower(_email) AND status = 'pending'
     ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF _credit IS NOT NULL THEN
    SELECT title INTO _project_title FROM public.projects WHERE id = _credit.project_id;
    INSERT INTO public.credits (user_id, project, role, year, verified)
    VALUES (_user, COALESCE(_project_title, 'Project'), _credit.role_name, EXTRACT(YEAR FROM now())::int, false);
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (_credit.project_id, _user, _credit.role_name)
    ON CONFLICT (project_id, user_id) DO NOTHING;
    UPDATE public.project_credit_invites
       SET status = 'accepted', accepted_by = _user, accepted_at = now(), updated_at = now()
     WHERE id = _credit.id;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (_credit.inviter_id, 'project_credit_invite_accepted', 'Credit invitation accepted',
            'Your invitation to ' || COALESCE(_project_title, 'a project') || ' was accepted.',
            jsonb_build_object('project_id', _credit.project_id, 'user_id', _user));
    IF _referrer IS NULL THEN _referrer := _credit.inviter_id; END IF;
  END IF;

  -- Set referred_by once
  IF _referrer IS NOT NULL THEN
    UPDATE public.profiles
       SET referred_by = _referrer
     WHERE user_id = _user AND referred_by IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'referrer', _referrer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_invites_on_signup(uuid, uuid) TO authenticated;

-- 8. Unique constraint for project_members upsert
DO $$ BEGIN
  ALTER TABLE public.project_members ADD CONSTRAINT project_members_project_user_uk UNIQUE (project_id, user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
