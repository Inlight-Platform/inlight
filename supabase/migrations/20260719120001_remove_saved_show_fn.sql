-- SECURITY DEFINER so the delete runs as the function owner and bypasses
-- the saved_shows SELECT policy (which references public.profiles directly,
-- a table the authenticated role cannot read). The function enforces the
-- same invariant the RLS DELETE policy does: only the owner can remove.
CREATE OR REPLACE FUNCTION public.remove_saved_show(p_show_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM saved_shows
  WHERE show_id = p_show_id
    AND user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.remove_saved_show(uuid) TO authenticated;
