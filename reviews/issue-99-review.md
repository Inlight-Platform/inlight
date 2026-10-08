# Issue #99 Review: Department Posting Controls and Identity

## Scope

This work implements department-scoped posting for updates/services, opportunities, events, and projects. It does not implement group event/audition tagging workflows, audition timeslots, School or Company account changes, or navigation renames.

The implementation builds on the scoped department administration and group-author identity work from Issue #98. Department-facing labels use "Department," while database objects retain the existing `group_*` naming.

## What Changed

### Access and RLS

- Hardened group-only post reads so access depends on current active membership or scoped department-admin access.
- Removed policy paths that allowed former members to continue reading group-only events and projects through creator or related-object access.
- Corrected the bootstrap sequence for linking newly created group-only posts and projects to their department.
- Added insert policies for `post_groups`, `event_groups`, and `project_groups` that respect the department member-posting setting.
- Preserved server-side validation that only scoped department admins can use a department author identity.
- Added scoped department-admin removal permissions without granting global moderation access.

Relevant migrations:

- `supabase/migrations/20260917120000_harden_group_only_post_reads.sql`
- `supabase/migrations/20260917121000_fix_group_post_tag_insert_policy.sql`
- `supabase/migrations/20260917122000_allow_group_post_link_bootstrap.sql`
- `supabase/migrations/20260917130000_add_group_member_posting_control.sql`
- `supabase/migrations/20260917131000_remove_group_content_read_policy_bypasses.sql`
- `supabase/migrations/20260917132000_restore_group_project_creation_bootstrap.sql`
- `supabase/migrations/20260917133000_allow_group_project_creation_returning.sql`
- `supabase/migrations/20260917134000_allow_department_admin_content_removal.sql`
- `supabase/migrations/20260917135000_expose_group_admin_authors_to_members.sql`

### Posting Controls

- Added `groups.members_can_post` and a scoped admin control for enabling or disabling active-member posting.
- When enabled, active members can target their department with an update/service, opportunity, event, or project.
- When disabled, regular members do not see department-specific posting entry points on either `/groups/:slug` or the selected department tab on Home.
- The global Home composer remains available for ordinary posting, but disabled departments are excluded from its audience options for regular members.
- Department admins retain department posting access regardless of the member toggle.
- The `/groups/:slug` composer uses the shared Home post creator in a modal, locks the audience to the current department, and does not expose Public or other-department audience choices.

### Author Identity

- Scoped department admins can choose their personal identity or `Department admin of <name>` when creating supported content.
- Regular members cannot select or forge a department identity.
- Home cards, group history, details drawers, and project creation use the saved Inlight profile name for personal identity.
- Department-authored cards resolve the department name and initial and show a `Department` badge without requiring a public department profile page.

### Department Feed UX

- Added All posts and Admin posts filtering. Admin posts include both admin-personal and department-identity content.
- Replaced the inline composer with a Home-style `Make a Post` button and modal.
- Aligned department metadata, posting controls, divider, margins, and responsive layout with Home.
- Added Grid and List modes. Grid reuses the Home bento card component, dense 12-column layout, and bento size sequence; List uses the Home-width centered column.
- Kept Posts, Members, the admin-post filter, and the Grid/List selector in one row on mobile.
- Added Home-style details drawers for updates/services and events from both Grid and List views. Projects continue to their project detail page.
- Preserved group-history moderation actions and comments where supported.

Primary source files:

- `src/components/feed/PostCreator.tsx`
- `src/components/feed/FeedBentoCard.tsx`
- `src/pages/FeedPage.tsx`
- `src/pages/GroupPage.tsx`
- `src/pages/ProjectNewPage.tsx`
- `src/hooks/useGroups.ts`

## Manually Verified

The following items were reported as passing during local testing on `http://127.0.0.1:8080` with local Supabase:

1. Active members can create department-only updates/services, opportunities, events, and projects when member posting is enabled.
2. Corresponding links are created in `post_groups`, `event_groups`, and `project_groups`.
3. Images render in department history for supported content.
4. Direct unauthorized inserts into `post_groups` and `event_groups` are rejected by RLS.
5. The corrected project creation bootstrap permits an authorized group project and rejects unauthorized direct linkage.
6. A regular member cannot create department-identity content through a direct database request; the database returns `P0001` with "Only group admins can post under a group identity."
7. Removed members lose access to former group-only content after the read-policy correction.
8. All posts and Admin posts filtering behaves as requested, including admin-personal and department-identity content.
9. Department-authored detail cards show the department identity and `Department` badge.
10. The last-active-admin database guard exists and rejects removal that would leave a department with no active admin.

Automated verification completed with `npm run test:ci`, including TypeScript checking, Vitest, production build, and Supabase configuration verification. The smoke-critical-path script reports that no placeholder smoke checks are currently configured.

## Open Questions and Risks

1. **Event/project moderation semantics:** A department admin can remove department content from group history. The product team still needs to decide whether this action should delete the underlying event/project everywhere or only unlink it from the department feed. This decision applies to both events and projects.
2. **Grid moderation controls:** The Home-style bento cards prioritize feed parity. Confirm that department admins still have an acceptable route to moderation in Grid mode, or decide whether bento cards need an explicit three-dot action overlay.
3. **Build-time Supabase configuration:** Automated build output reports the configured URL as `https://piofmmawwnermvaysonw.supabase.co`, although implementation and manual testing were restricted to local Supabase. Confirm the intended environment-file precedence before any deployment workflow is run. No hosted migration was applied during this work.
4. **No automated critical-path smoke coverage:** The current CI command passes, but the smoke script states that no critical-path smoke checks are configured. The member/admin two-account workflows remain primarily manually verified.

## Acceptance Criteria Status

1. Group members/admins can create group-only supported content from the department tab and main composer: implemented and manually exercised.
2. Department admins can remove department content without global moderation access: implemented; event/project delete-versus-unlink semantics remain a product decision.
3. Department history supports All posts and Admin posts filtering: implemented and manually confirmed.
4. Department admins can choose personal or department identity: implemented and manually confirmed.
5. Department-authored content displays department identity without a public profile page: implemented and manually confirmed.
6. RLS restricts group-only reads to current members/admins: implemented and manually exercised, including former-member removal behavior.
7. Existing public/network/specific behavior is preserved: no intentional changes were made to those audience paths; final regression confirmation remains part of release testing.

The issue remains open. Closing the issue and all GitHub operations are reserved for the repository owner.
