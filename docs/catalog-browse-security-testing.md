# Film and Show Browse Security

Scope: user_films_browse, user_music_shows_browse, nyc_shows_browse.
The other eleven flagged views remain pending.

## Why the Warning Matters

The current views execute using their creator's privileges. That bypasses the
source tables' owner/admin SELECT policies. Explicit active-row filters and
column lists currently prevent our synthetic inactive rows and submitter UUIDs
from appearing, so these tests do not demonstrate an existing disclosure.
However, privacy depends on the view definition rather than caller RLS, and a
future view change could expose protected rows or columns.

Simply setting security_invoker=true fails public browsing because the source
tables permit only owner/admin reads. Granting broad source reads would expose
submitter identity. The migration therefore stores only explicitly allowed
catalog fields in three public projection tables, with active-only SELECT RLS
and no client write privileges. Existing view names, columns, and public/owner
behavior stay compatible. The invoker views read those projections.

A separate ownership table has self-only SELECT RLS. Its invoker helper returns
only whether auth.uid() owns a catalog row. Other users' ownership records are
inaccessible. A private, non-client-callable definer trigger synchronizes both
the public fields and ownership after source insert/update/delete/truncate.
No source-table privileges or policies are broadened.

## Exact Local Tests

Run from the worktree against the disposable local Supabase database:

```sh
node scripts/test-catalog-browse-security.mjs
node scripts/test-catalog-browse-security.mjs --naive
node scripts/test-catalog-browse-security.mjs --fix
```

Expected: baseline passes; --naive fails with Anonymous browse boundary failed;
--fix passes. Every run is rollback-only, including schema, fixtures and truncate.
The runner reconstructs the relevant baseline from the repository migration
because local Supabase predates this security change. It is hardcoded to local
port 54322 and does not apply changes to hosted environments.

Tests cover anonymous active reads, inactive exclusion, omitted submitted_by,
owner vs unrelated-user is_owner, raw-row isolation, unauthorized writes,
view invoker configuration, projection write grants/RLS, self-only ownership,
owner edits, reactivation, inserts, deletes, ownership transfer, and truncate.
Synthetic NYC shows use category school to respect existing edit policies.

## Sandbox Confirmation

1. After approved push/PR creation, confirm migration
   20261013030000_catalog_browse_invoker_views.sql succeeds in sandbox.
2. In Supabase SQL Editor, inspect options:

```sql
select relname, reloptions
from pg_class
where oid in ('public.user_films_browse'::regclass,
              'public.user_music_shows_browse'::regclass,
              'public.nyc_shows_browse'::regclass);
```

All three must include security_invoker=true. Re-run Security Advisor: these
three view findings should disappear; the other eleven are outside this fix.

3. Query all three browse endpoints signed out and signed in. Expect active
   catalog entries, no submitted_by column, and is_owner=false signed out.
   For a known owner, only their own entries may have is_owner=true. The same
   entry must report false for an unrelated signed-in account.
4. In sandbox, create/edit a film, music show, and school NYC show as their
   authorized owner. Verify browse text updates immediately. Deactivate and
   reactivate: anonymous browse must hide and restore the row. Delete: it must
   disappear. An unrelated account must not edit/delete it.
5. Query the source table as an unrelated account: the owner's raw row and
   submitted_by must remain inaccessible. catalog_ownership must show only
   the querying user's own records; signed out it must show zero rows.
6. Check existing saved-show, attended-show, and message detail flows for
   permission errors. Industry Now remains intentionally hidden; do not
   re-enable it for these checks. Direct Data API calls can test film/music
   browse behavior even while that page is hidden.

## Production Preview

After sandbox confirmation, use GitHub Actions -> Supabase Database Migrations
on codex/catalog-browse-security. Run with apply unchecked first, inspect the
pending migration list, then apply after authorization. This migration adds
three sanitized catalog tables and one ownership table, backfills existing
rows, installs synchronization triggers, and changes the three views.
It briefly blocks source writes during the atomic backfill.

Repeat steps 2, 3, 5 and the read-only portions of 6 using existing production
data. Do not run local fixture/truncate tests in production. Confirm public
active-row counts match the pre-migration counts and no additional Advisor
errors appear. The remaining view findings are handled in later PRs.

A database restore/import that disables triggers must backfill these projections
before resuming the app; normal writes synchronize automatically.
