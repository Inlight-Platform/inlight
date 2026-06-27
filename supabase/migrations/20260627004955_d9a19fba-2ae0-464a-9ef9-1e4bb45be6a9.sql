DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = '819annietmail@gmail.com';
  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
      '819annietmail@gmail.com', crypt('@Anniet819', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name','Annie (Strasberg Faculty)'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _uid, jsonb_build_object('sub', _uid::text, 'email','819annietmail@gmail.com'), 'email', _uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('@Anniet819', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = _uid;
  END IF;

  -- Ensure profile
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (_uid, '819annietmail@gmail.com', 'Annie (Strasberg Faculty)')
  ON CONFLICT (user_id) DO NOTHING;

  -- Ensure Strasberg group exists and assign faculty owner
  INSERT INTO public.groups (slug, name, faculty_owner_id)
  VALUES ('strasberg', 'Strasberg', _uid)
  ON CONFLICT (slug) DO UPDATE SET faculty_owner_id = EXCLUDED.faculty_owner_id;
END $$;