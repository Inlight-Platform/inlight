BEGIN;

-- INV96 keeps department attribution available to signed-in members while
-- preventing signed-out callers from resolving author identities.
REVOKE EXECUTE ON FUNCTION public.get_public_group_authors(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_group_authors(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;

GRANT EXECUTE ON FUNCTION public.get_public_group_authors(uuid[]) TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
*/
