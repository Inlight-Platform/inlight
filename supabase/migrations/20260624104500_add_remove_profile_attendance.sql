CREATE OR REPLACE FUNCTION public.remove_profile_attendance(_kind text, _item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _kind = 'event' THEN
    UPDATE public.event_rsvps
    SET attended = false,
        attended_at = NULL
    WHERE user_id = _user_id
      AND event_id = _item_id;
  ELSIF _kind = 'show' THEN
    UPDATE public.saved_shows
    SET attended = false,
        attended_at = NULL
    WHERE user_id = _user_id
      AND show_id = _item_id;
  ELSE
    RAISE EXCEPTION 'Unsupported attendance kind: %', _kind;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_profile_attendance(text, uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
