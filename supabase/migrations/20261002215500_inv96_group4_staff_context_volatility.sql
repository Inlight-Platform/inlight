BEGIN;

-- Staff-token validation records last use, so this wrapper must permit writes.
ALTER FUNCTION public.get_company_management_context(uuid, text) VOLATILE;

COMMIT;

/*
ROLLBACK (manual; place in a new migration before running):

BEGIN;
ALTER FUNCTION public.get_company_management_context(uuid, text) STABLE;
COMMIT;
*/
