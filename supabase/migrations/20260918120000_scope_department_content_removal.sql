-- Department moderation removes an item from that department's feed by deleting
-- its association row. It must not grant deletion of the underlying content.
DROP POLICY IF EXISTS "Department admins can delete linked events"
ON public.events;

DROP POLICY IF EXISTS "Department admins can delete linked projects"
ON public.projects;

NOTIFY pgrst, 'reload schema';
