-- Admin-callable RPC to send a notification to the affiliation request owner.
-- Direct client inserts into notifications are blocked by RLS, so we use a
-- SECURITY DEFINER function that checks the caller is an admin before inserting.
CREATE OR REPLACE FUNCTION public.notify_affiliation_reviewed(
  p_user_id   uuid,
  p_action    text,   -- 'approved' or 'denied'
  p_name      text,
  p_notes     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_title := CASE p_action
    WHEN 'approved' THEN 'Affiliation "' || p_name || '" approved'
    ELSE 'Affiliation request for "' || p_name || '" denied'
  END;

  v_body := CASE
    WHEN p_notes IS NOT NULL AND p_notes <> '' THEN 'Admin note: ' || p_notes
    WHEN p_action = 'approved' THEN 'Your affiliation has been added and is now selectable on your profile.'
    ELSE NULL
  END;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'affiliation_request',
    v_title,
    v_body,
    jsonb_build_object(
      'requested_name', p_name,
      'status', p_action,
      'admin_notes', p_notes
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_affiliation_reviewed(uuid, text, text, text) TO authenticated;
