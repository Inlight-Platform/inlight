# Projects Browse Security

## Scope

This fix addresses `public.projects_browse`, the final Security Definer View
finding from the original list. It does not claim to resolve unrelated Advisor
warnings or findings introduced outside that list.

The old view reads protected projects with its owner's permissions, filters with
`public.can_browse_project(id)`, and hides creator/group attribution when
`auth.uid()` is null. A plain invoker switch breaks anonymous discovery and
column-restricted signed-in reads. Granting access to the raw projects table
instead could expose member-only/workflow fields.

Migration `20261013230000_projects_browse_invoker.sql` makes the existing view
security invoker/security barrier over two read-only RLS catalogs:

- Metadata contains only existing browse-safe columns. Both visitor and
  signed-in policies use the unchanged `can_browse_project` helper.
- Attribution contains only project ID, creator ID and author identity/group.
  Only authenticated users with a non-null identity and browse access receive
  rows. Anonymous joins have no attribution rows and retain null author fields.

The catalogs store safe fields for all projects, including private ones;
caller-specific RLS controls access to those rows. There is no anonymous read
policy for attribution. Clients cannot write either catalog or invoke the
private synchronization trigger.

Source permissions, ownership policies, browse audience logic, company/member
RPCs, project URLs, and frontend behavior remain unchanged. The existing helper
uses `is_public` plus owner/member/invite/group/admin access; this migration does
not reinterpret visibility strings or add network/recipient permissions.
Membership/invitation/group/admin revocations are evaluated on every new query,
without needing to rewrite project catalogs.

## Local Verification

All fixtures, DDL, edits, ownership changes, deletes and truncation run only in
the disposable `127.0.0.1:54322` database and roll back.
Never run fixture/assertion/projection scripts against hosted databases.

```sh
node scripts/test-projects-browse-security.mjs
node scripts/test-projects-browse-security.mjs --naive
node scripts/test-projects-browse-security.mjs --fix
```

Baseline and fix must pass. The naive conversion must fail with permission
denied for projects. Tests snapshot the original rows/fields/types for visitors
and nine identities: owner, member, invitee, active group member, faculty,
admin, unrelated user, pending group member and group admin.
They verify ownership isolation, protected source fields, public/private
boundaries, attribution masking, access revocation/restoration, admin demotion,
metadata synchronization, future private columns, ownership/key changes,
insertion/deletion/truncation, client privileges and private trigger execution.
The fix run also installs the merged role projection and checks its parity
after project mutations. No frontend code is changed.

## Sandbox Confirmation

1. Wait for the new PR sandbox deployment and migration
   `20261013230000_projects_browse_invoker.sql`. Hard-refresh the preview.
2. Signed out, open `/projects`, Home project cards, and a known public project
   directly. Refresh the detail URL. `projects_browse` requests must return 200,
   and public content/links must match before the migration.
3. Inspect the response: `creator_id`, `author_identity`, and
   `author_group_id` must be null when signed out. No `google_drive_url`,
   member-only configuration, or unrelated private project content may appear.
4. As ordinary owner A, create labeled public/private sandbox projects. A can
   view/edit both. Sign in as unrelated B: B can browse the public project but
   has no owner editing/deletion controls and cannot browse A's private project.
   Open each project's UUID-based link directly and refresh to verify routing.
5. Add B as a member or invitee of the private project using normal controls;
   verify B's existing access works. Remove/cancel that access through supported
   controls, then hard-refresh as B: private browse access must disappear.
   If B has multiple independent access paths, remove all of them before
   expecting denial. A must retain owner access throughout.
6. Where a sandbox department fixture is available, open its tagged project as
   an active member and a group admin/faculty user. Existing project cards and
   authorized group attribution must work. An unrelated or pending member
   must not gain access. Leave existing production memberships untouched.
7. Signed in, inspect an authorized project response: creator/author fields must
   retain the correct original identity. Edit A's public title/description/
   deadline and refresh signed out to verify synchronized metadata. Make that
   project private: it disappears for visitors, while A retains access. Make
   it public again: it returns.
8. Recheck Jobs/Open Roles: public unassigned roles still render with the current
   project title/deadline; roles on a newly private project disappear signed out.
   Delete only your labeled sandbox test projects and verify cards disappear.
9. Run the entire `supabase/tests/projects_browse_hosted_readonly.sql` as
   administrator in sandbox SQL Editor. It automatically selects one real
   non-admin account and only simulates reads. Expect `Projects browse checks
   passed`, anonymous/signed-in counts, and the tested user's UUID, with no errors.
   It requires at least one non-admin account. Zero counts can be legitimate
   but do not replace the manual access fixtures. On error, run `ROLLBACK;`.
10. Re-run Security Advisor: `projects_browse` must no longer have a definer-view
    error. Confirm all 14 original view findings are now absent, without new
    findings. Other warning categories require separate review.

## Production Preview

After sandbox confirmation, run **Supabase Database Migrations** on this PR's
branch with Apply unchecked first. Review all pending migrations; apply only
after the dry run shows expected changes and you approve them.
Do not add `apply-production-migrations` before approval.

On the production-data preview, repeat steps 2, 3, 9 and 10 read-only.
Use existing owner/member/invitee/group-admin/unrelated accounts to inspect
expected project access, attribution and controls without changing anything.
Also inspect existing Jobs/Open Roles for unchanged project title/deadline cards.
Do not create/edit/delete projects, change memberships/invitations/admin roles,
assign roles, change privacy or submit applications in production.
Never run fixture/mutation/truncate scripts there. Confirm before merging.

Backfill is atomic and briefly blocks project writes. Imports/restores that
disable triggers require rebuilding both safe-field catalogs before app traffic
resumes. Rebuild from the explicit allowed columns, never from raw SELECT *.
