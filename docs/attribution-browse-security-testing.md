# Signed-In Attribution Browse Security

This fix covers `show_teammates_browse`, `show_tips_browse`, `studios_browse`,
`studio_posts_browse`, and `studio_comments_browse`. Five of the original fourteen
view findings remain after this fix: opportunities, posts, events, project roles,
and projects. The previous company and film/show fixes remain unchanged.

## Security Boundary

These five views intentionally expose their existing presentation fields and
real author/teammate user IDs to signed-in users, not signed-out visitors. The
source tables remain author/participant/admin-only for raw reads and writes.
The views have no inactive/private-row filter today; this fix does not introduce
one or make user attribution anonymous. Hidden data means signed-out access and
future private source fields, not hiding attribution from other signed-in users.

Definer views rely on their creator's privileges rather than caller RLS. See
https://supabase.com/docs/guides/database/views. Invoker-only conversion would
hide other users' posts/tips and all studios from ordinary users. Broadening raw
source access would change the existing security boundary. Instead, this fix
uses explicit-field, read-only projections with signed-in SELECT RLS and invoker
views. A private trigger maintains them; clients cannot execute it or write to
the projections. Source policies and grants stay unchanged.

## Local Tests

```sh
node scripts/test-attribution-browse-security.mjs
node scripts/test-attribution-browse-security.mjs --naive
node scripts/test-attribution-browse-security.mjs --fix
```

Baseline passes. Naive conversion fails `Signed-in browse failed`. Fix passes.
The runner reconstructs relevant baseline policies in the disposable local
database at port 54322, and rolls back schema, fixtures, and all mutations.
Do not run fixture or projection-mutation SQL against hosted databases. The
runner assumes this new migration is not already installed in the local DB.

Coverage includes all five views' data/column compatibility, anonymous denial,
missing identity denial, signed-in reads, raw source isolation, author reads,
unauthorized updates/deletes, forged-author inserts, author identity rewrites,
non-admin studio creation denial, admin source reads/studio insertion, projection write grants, private trigger
execution, live insert/edit/delete synchronization, teammate self-removal,
future private fields, primary-key changes, cascade deletion, and truncate.

## Sandbox Manual Tests

1. Confirm `20261013140000_attribution_browse_invoker_views.sql` succeeds in the
   sandbox preview workflow. Choose two ordinary non-admin sandbox accounts.
2. Open `/insights`, select the School tab, and open a studio while signed in.
   Studio names, posts, images, comments, and real author identities should load.
   Check the relevant browse requests in Network for new permission errors.
3. Using account A, create a clearly labeled sandbox post and comment. Account B
   must see them after refresh, with A's identity. B may add B's own comment;
   A must see it after refresh. This screen currently has no edit/delete controls;
   do not expect new controls from this database-only fix. Local role tests cover
   author edit/delete rights and denial for unrelated users. Clean up these test
   records only in the sandbox SQL Editor, using the exact IDs from Network:

```sql
delete from public.studio_posts where id = 'SANDBOX_TEST_POST_UUID';
-- Cascades its comments. Refresh as B: the post/comments must disappear.
```
4. Open `/people` and `/pie-chart`; studio labels/filters should still populate.
   Profile and group-member studio labels should remain unchanged where present.
5. Show teammates/tips use the intentionally hidden Industry Now feature. Do
   not re-enable `/industry-now` or `/stage-whisper` to test these views. Use the
   hosted read-only SQL below for their read checks. Local tests cover author tip
   edits, submitter teammate additions, and teammate self-removal.
6. Sign out and try `/insights`. Existing authentication behavior should remain.
   UI redirects alone do not prove security: run the SQL role checks below.

## Hosted Database Checks

Run `supabase/tests/attribution_browse_hosted_readonly.sql` in the target
environment's SQL Editor as database administrator, replacing its placeholder
with a real non-admin user UUID from that environment. It performs no mutations.
It must complete without errors. It checks all five invoker/barrier options,
source/projection counts and browse field parity, anonymous denial for views and
direct projections, authenticated browse counts, and denied client write grants.
Nonempty data is preferable: an empty table proves access boundaries but cannot
prove real displayed content. Also inspect the following raw-row checks using B
and A's existing post/tip/comment IDs where those rows exist:

```sql
begin read only;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ACCOUNT_B_UUID', true);
select id, user_id, content from public.studio_posts_browse where id = 'ACCOUNT_A_POST_UUID';
-- One row, attributed to A.
select count(*) from public.studio_posts where id = 'ACCOUNT_A_POST_UUID';
-- Zero rows for unrelated non-admin B.
rollback;
```

Repeat that pattern for `show_tips` and `studio_comments` with existing A-owned
IDs. Show teammates differ: the listed teammate, show submitter, or admin may
read the raw row. An unrelated B who is none of these must see zero raw rows,
but still see the row in `show_teammates_browse`. Ordinary users must see no raw
`studios` rows while still seeing `studios_browse` rows. Admin source access is
unchanged. Author IDs in browse responses are intentional, not a test failure.

Re-run Security Advisor. The five named view findings must disappear without
new security findings. The other five are outside this PR.

## Production Preview

After sandbox confirmation, run Supabase Database Migrations on
`codex/attribution-browse-security` with Apply unchecked first. Review all pending
migrations and authorize only the expected list before running with Apply checked.
Deployment alone does not apply production migrations without the existing gate.

On the production-data preview, repeat signed-in read-only UI checks and all
hosted read-only SQL checks using production IDs. Do not create/edit/delete posts,
comments, tips, studios, or teammates in production for testing. Do not run local
fixtures, source truncation, or mutation tests in production. Confirm before merge.

The migration briefly blocks writes to the five sources for atomic backfill.
Imports/restores that disable triggers require projection backfill before app
traffic resumes. The projections are read-only presentation data, not the source
of truth; existing source-table mutation and cascade behavior is preserved.
