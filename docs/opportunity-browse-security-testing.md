# Opportunity Browse Security

## Scope

This fix addresses only the Security Definer View finding for
`public.opportunities_public_browse`. Project-role and project browse findings
remain for subsequent fixes.

The existing owner-permission view deliberately bypasses source RLS to expose
sanitized internal-job teasers. Switching it directly to caller permissions
removes those teasers. Granting anonymous access to internal source rows instead
would expose protected descriptions/application details.

Migration `20261013210000_opportunity_browse_invoker.sql` replaces the public
view's source with a read-only, RLS-protected sanitized catalog and sets
`security_invoker=true` and `security_barrier=true`. A private trigger keeps it
synchronized. Caller roles cannot write the catalog or invoke the trigger.
Existing source grants, ownership policies, billing and application logic stay
unchanged. No frontend changes are required.

Public eligibility is intentionally unchanged:

- Internal jobs with status `open` appear as teasers, even when `is_public=false`.
  Their description is empty, compensation/link fields are null, roles and
  requirements are empty arrays, and `posted_by` is null.
- External jobs appear only when `is_public=true` and the URL is nonblank.
  Their approved public details remain visible; `posted_by` is null.
- Closed internal jobs, nonpublic external jobs, and external jobs with blank
  or null URLs are absent. Public external jobs retain existing closed-status
  behavior; the frontend may filter them by status.
- Signed-in users retain the existing source-table read policy, including
  internal job details. This fix does not introduce a new signed-in visibility rule.

## Local Verification

Only a disposable local database at `127.0.0.1:54322` is used. All fixtures,
policy reconstruction, DDL, edits, deletes, and truncation roll back.
Never paste the fixtures/projection scripts into a hosted SQL Editor.

```sh
node scripts/test-opportunity-browse-security.mjs
node scripts/test-opportunity-browse-security.mjs --naive
node scripts/test-opportunity-browse-security.mjs --fix
```

Baseline and fix must pass. The naive conversion must fail with
`Public teaser eligibility failed`, demonstrating why a plain invoker switch
is insufficient. Tests cover original row/column/type compatibility, public
access and masking, hidden rows, owner edits, denied unrelated edits/deletes,
spoofed ownership, owner reassignment, status/public/link transitions,
internal/external conversion, future private columns, key changes, insertion,
deletion, truncation, client privileges and private trigger execution.
Unrelated billing/notification triggers are disabled only inside the local
rollback tests; they are not modified by the migration.

## Sandbox Confirmation

1. Wait for the new PR sandbox deployment and successful migration
   `20261013210000_opportunity_browse_invoker.sql`. Hard-refresh the preview.
2. Signed out, open `/opportunities` and refresh. Internal open jobs must remain
   as teaser cards, public external jobs must remain available, and Network
   `opportunities_public_browse` requests must return 200 without permission errors.
3. Inspect an internal teaser's Network response: `posted_by=null`,
   `description=""`, `compensation=null`, empty `roles`/`requirements`,
   `link_url=null`, `link_title=null`. Clicking it must retain the sign-in gate
   for protected details/application. A public external card keeps its external
   link and approved details.
4. As ordinary owner A, create clearly labeled sandbox internal/external jobs
   using normal controls. Account B must not receive owner editing/deletion
   rights. A must retain those controls and signed-in application behavior.
   Do not submit purchases merely to exercise job creation; use an account with
   existing sandbox posting permission/credits.
5. Edit A's title; verify signed-out cards update after reload. Close an internal
   job; its teaser must disappear, then reappear when reopened. Where the normal
   UI supports it, disable public external visibility/remove its URL; that job
   must disappear. Internal protected details must never become public.
   Delete only these labeled sandbox jobs and verify their cards disappear.
6. Run the entire `supabase/tests/opportunity_browse_hosted_readonly.sql`
   as administrator in sandbox SQL Editor. Expect
   `Opportunity browse checks passed` and a public teaser count, with no errors.
   Zero is valid if no eligible data exists, but does not replace fixture/UI tests.
   On any error, run `ROLLBACK;` before retrying.
7. Re-run Security Advisor: the `opportunities_public_browse` definer-view finding
   must disappear without new findings. Project-role/project findings remain.

## Production Preview

After sandbox approval, run the manual **Supabase Database Migrations** workflow
on this PR's branch with Apply unchecked first. Review all pending migrations;
apply only after the dry run lists the expected changes and you approve them.
Do not add `apply-production-migrations` prematurely.

On the production-data preview, repeat steps 2, 3, 6 and 7 read-only. Sign in as
an owner/non-owner to inspect expected detail and management controls without
editing, deleting, applying, or purchasing. Use existing records; do not run
local fixtures, projection mutation tests, or truncation against production.
Confirm before merging.

Backfill is atomic and briefly blocks opportunity writes. Imports/restores that
disable triggers require a sanitized catalog rebuild before app traffic resumes;
never copy unmasked source rows into this public catalog.
