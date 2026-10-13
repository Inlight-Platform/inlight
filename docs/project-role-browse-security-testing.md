# Public Project Role Security

## Scope

This fix addresses only `public.project_roles_public_browse`.
The `projects_browse` definer-view finding remains for the final fix.

The original view runs with its owner's permissions to join protected projects
and roles. A plain invoker switch fails anonymous discovery because visitors
cannot read either raw table. Granting raw access would broaden access to
private project/workflow fields and assigned-user identities.

Migration `20261013220000_project_role_browse_invoker.sql` uses a sanitized,
read-only RLS catalog and enables security invoker/security barrier on the
existing view. The same six columns/types are retained:
`id, role_name, project_id, project_title, project_deadline, created_at`.
Only roles with no assigned user on projects with `is_public=true` are stored.
Private projects, null public flags, and assigned roles remain excluded.
Eligibility intentionally follows the existing `is_public` rule, not a new
visibility/group rule. Creator/assignee IDs and member-only fields are absent.

Private non-client-callable triggers synchronize roles and parent metadata,
privacy changes, deletion, and truncation. Child changes lock parent rows with
NO KEY UPDATE to serialize them with parent changes while remaining compatible
with foreign-key KEY SHARE locks. Source grants, ownership rules, applications,
and frontend behavior remain unchanged.

## Local Tests

Only the disposable local database at `127.0.0.1:54322` is used. Fixtures,
migration DDL, mutations, and truncation all roll back.
Never run local fixture/assertion/projection scripts against hosted databases.

```sh
node scripts/test-project-role-browse-security.mjs
node scripts/test-project-role-browse-security.mjs --naive
node scripts/test-project-role-browse-security.mjs --fix
```

Baseline and fix must pass. The naive conversion must fail with permission
denied for `project_roles`. Coverage includes public discovery, assigned/private
exclusion, unchanged columns/types/rows, denied raw anonymous access, denied
unrelated edits/deletes/inserts, owner private reads and role CRUD, assignment
and unassignment, parent title/deadline/privacy changes, role movement between
public/private parents, future private fields, key changes, role/project deletion,
both truncation paths, client grants, and private trigger execution.
Concurrent multi-session behavior is not exercised by this rollback-only suite.

## Sandbox Confirmation

1. Wait for a successful PR sandbox deployment and migration
   `20261013220000_project_role_browse_invoker.sql`. Hard-refresh the preview.
2. Signed out, open `/opportunities` (Jobs, Discover) and
   `/projects`, then select Open Roles. Existing unfilled public-project
   roles must remain. Network `project_roles_public_browse` requests must return
   HTTP 200 without permission errors.
3. Inspect those responses: only the six fields listed above may appear.
   No `assigned_user_id`, `creator_id`, drive URLs, application data or private
   project details. Click Apply signed out: retain the sign-in prompt, not a
   submitted application. Project links must still open the correct project.
4. As ordinary owner A, create two labeled sandbox projects: one public and one
   private. Add one unassigned role to each. Signed out, only the public
   project's role appears. Account B must not gain role management controls or
   access to the private project's role.
5. As A, rename the public project's title and change its deadline. Reload
   signed out: role cards must show the new values. Add a separate role with a
   sandbox member selected in the role builder; this assigned role must not
   appear signed out. Role renaming and assignment/unassignment transitions
   are covered by the local SQL tests; no unsupported UI operation is required.
6. Make A's public project private: all its public role cards disappear. Make
   it public again: only its unassigned roles return. Delete a test role and
   verify disappearance; then clean up only the labeled sandbox projects.
   Owner role creation/editing/deletion and private-project access must work.
7. Run the entire `supabase/tests/project_role_browse_hosted_readonly.sql` as
   administrator in sandbox SQL Editor. Expect
   `Project role browse checks passed` and a public role count, with no errors.
   Zero is valid with no eligible data but does not replace the fixture/UI tests.
   On an error, run `ROLLBACK;` before retrying.
8. Re-run Security Advisor: the `project_roles_public_browse` definer-view error
   must disappear without new findings. `projects_browse` remains for later.

## Production Preview

After sandbox confirmation, run **Supabase Database Migrations** on this PR's
branch with Apply unchecked first. Review all pending changes; apply only after
the dry run shows expected migrations and you approve them.
Do not add `apply-production-migrations` before approval.

Using the production-data preview, repeat steps 2, 3, 7 and 8 read-only.
Inspect existing owner/non-owner controls without editing, assigning, deleting,
submitting applications, or changing privacy. Use existing data.
Never run fixtures, mutation tests or truncation against production.
Confirm both environments before merging.

Backfill is atomic and briefly blocks project/role writes. Imports/restores that
disable triggers require rebuilding only the sanitized eligible-role catalog
before app traffic resumes; never copy raw role rows into the public catalog.
