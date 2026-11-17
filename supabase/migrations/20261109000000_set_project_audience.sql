CREATE FUNCTION public.set_project_audience(
  target_project_id uuid,
  target_audience text,
  target_group_id uuid,
  target_recipient_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creator uuid;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Project unavailable or unauthorized';
  END IF;

  SELECT p.creator_id INTO v_creator
  FROM public.projects AS p
  WHERE p.id = target_project_id
  FOR UPDATE;
  IF NOT FOUND OR v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Project unavailable or unauthorized';
  END IF;

  IF target_audience IS NULL OR target_audience NOT IN ('private', 'public', 'network', 'specific', 'group')
    OR target_recipient_ids IS NULL THEN
    RAISE EXCEPTION 'Invalid audience arguments';
  END IF;
  IF target_audience = 'group' THEN
    IF target_group_id IS NULL OR pg_catalog.cardinality(target_recipient_ids) <> 0
      OR public.can_post_to_group(auth.uid(), target_group_id) IS NOT TRUE THEN
      RAISE EXCEPTION 'Invalid or unauthorized group';
    END IF;
  ELSIF target_group_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid audience arguments';
  END IF;
  IF target_audience = 'specific' THEN
    IF pg_catalog.cardinality(target_recipient_ids) = 0
      OR EXISTS (SELECT 1 FROM pg_catalog.unnest(target_recipient_ids) AS r(id) WHERE r.id IS NULL)
      OR (SELECT count(DISTINCT r.id) FROM pg_catalog.unnest(target_recipient_ids) AS r(id)) <> pg_catalog.cardinality(target_recipient_ids) THEN
      RAISE EXCEPTION 'Invalid audience arguments';
    END IF;
  ELSIF pg_catalog.cardinality(target_recipient_ids) <> 0 THEN
    RAISE EXCEPTION 'Invalid audience arguments';
  END IF;

  DELETE FROM public.project_recipients AS r WHERE r.project_id = target_project_id;
  DELETE FROM public.project_groups AS g WHERE g.project_id = target_project_id;
  UPDATE public.projects AS p
    SET visibility = target_audience, is_public = (target_audience = 'public')
    WHERE p.id = target_project_id AND p.creator_id = auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Project unavailable or unauthorized';
  END IF;
  IF target_audience = 'specific' THEN
    INSERT INTO public.project_recipients (project_id, recipient_id)
      SELECT target_project_id, r.id FROM pg_catalog.unnest(target_recipient_ids) AS r(id);
  ELSIF target_audience = 'group' THEN
    INSERT INTO public.project_groups (project_id, group_id)
      VALUES (target_project_id, target_group_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects AS p
    WHERE p.id = target_project_id AND p.creator_id = auth.uid()
      AND p.visibility = target_audience AND p.is_public IS NOT DISTINCT FROM (target_audience = 'public')
  ) OR (SELECT count(*) FROM public.project_groups AS g WHERE g.project_id = target_project_id)
       <> (CASE WHEN target_audience = 'group' THEN 1 ELSE 0 END)
    OR (target_audience = 'group' AND NOT EXISTS (
      SELECT 1 FROM public.project_groups AS g
      WHERE g.project_id = target_project_id AND g.group_id = target_group_id
    ))
    OR (SELECT count(*) FROM public.project_recipients AS r WHERE r.project_id = target_project_id)
       <> (CASE WHEN target_audience = 'specific' THEN pg_catalog.cardinality(target_recipient_ids) ELSE 0 END)
    OR (target_audience = 'specific' AND
      (SELECT count(DISTINCT r.recipient_id) FROM public.project_recipients AS r WHERE r.project_id = target_project_id)
        <> pg_catalog.cardinality(target_recipient_ids))
    OR (target_audience = 'specific' AND EXISTS (
      SELECT 1 FROM public.project_recipients AS r
      WHERE r.project_id = target_project_id AND (r.recipient_id IS NULL OR NOT (r.recipient_id = ANY(target_recipient_ids)))
    )) THEN
    RAISE EXCEPTION 'Audience state mismatch';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_audience(uuid, text, uuid, uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_project_audience(uuid, text, uuid, uuid[]) TO authenticated;
