-- Store and update a member's event attendee-list privacy preference through RPC.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS anonymous_event_rsvps boolean NOT NULL DEFAULT false;

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_my_event_privacy_preference()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT p.anonymous_event_rsvps
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
      LIMIT 1
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.set_my_event_privacy_preference(should_attend_anonymously boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_value boolean := COALESCE(should_attend_anonymously, false);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update event privacy preference';
  END IF;

  UPDATE public.profiles
  SET
    anonymous_event_rsvps = next_value,
    updated_at = now()
  WHERE user_id = auth.uid();

  UPDATE public.event_rsvps
  SET is_anonymous = next_value
  WHERE user_id = auth.uid();

  RETURN next_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_event_privacy_preference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_event_privacy_preference(boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
