CREATE OR REPLACE FUNCTION public.get_profile_pronouns_settings()
RETURNS TABLE(pronouns text, show_pronouns boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.pronouns, p.show_pronouns
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_pronouns_settings(_pronouns text, _show_pronouns boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET
    pronouns = NULLIF(BTRIM(_pronouns), ''),
    show_pronouns = COALESCE(_show_pronouns, true),
    updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_pronouns_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_pronouns_settings(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_pronouns_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_profile_pronouns_settings(text, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';