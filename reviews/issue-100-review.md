# Issue #100 Review: Group-Scoped Resources and Activity Insights

## Status

Phase 3 implementation and manual verification are complete for all five approved gaps. This review does not close GitHub issue #100.

The work was developed against the local application and local Supabase environment only. No hosted Supabase environment was targeted as part of this work.

## Scope Delivered

- Department event and project removal now unlinks the item from the selected department without deleting the parent record.
- Removed department events and projects become private to their creator, and the creator receives a notification with a direct link to the item.
- Creators can subsequently choose a new audience using the standard audience options.
- Department resources support draft and published states.
- Department admins can create, edit, publish, unpublish, and delete resources for their department.
- Active department members can view published department resources from the department page.
- Draft resources remain visible to scoped department admins and unavailable to regular members and non-members.
- The department dashboard provides group-scoped membership, content, invite, student, alumni, and recent-activity metrics.
- The existing global Resources page and manager remain separate and unchanged by the department resource implementation.

## Implementation By Gap

### Gap 1: Safe Department Content Removal

- Added the `remove_group_content` RPC to perform department unlinking atomically.
- Event removal deletes only the matching `event_groups` association.
- Project removal deletes only the matching `project_groups` association.
- The parent event or project remains owned by and available to its creator.
- Removed content is reset to a creator-only private audience.
- Existing recipient targeting is cleared when the item becomes private.
- The creator receives a notification containing a direct path to the affected item.
- Department removal closes an open details drawer and removes the item from the department feed immediately.
- The creator can later select Private, Everyone, My Network, Specific People, or an eligible department audience.

Relevant migration:

- `supabase/migrations/20260918143000_private_content_after_department_removal.sql`

### Gap 2: Resource Publication And RLS

- Added `group_resources.is_published boolean NOT NULL DEFAULT true`.
- Existing resources remain published after migration.
- Active scoped department admins can read all resources for their department.
- Active members can read only published resources for departments they belong to.
- Non-members cannot read private department resources through direct authenticated queries.
- Create, update, and delete access remains restricted to scoped department admins.
- Inserts continue to require `created_by = auth.uid()`.

Relevant migration:

- `supabase/migrations/20260918150000_add_group_resource_publication.sql`

### Gap 3: Department Admin Resource Management

- Reused one form for creating and editing resources.
- Added Draft and Published status controls and badges.
- Added Edit, Publish/Unpublish, and confirmed Delete actions.
- All resource management queries remain filtered to the selected department.
- The platform-wide `ResourcesManager` was not reused or modified.

Primary file:

- `src/pages/GroupAdminDashboardPage.tsx`

### Gap 4: Member Resource Library

- Added a Resources tab to the department page beside Posts and Members.
- The tab queries `group_resources` for the current department only.
- Published resources display their title, description, and external link.
- UI membership checks supplement database RLS; RLS remains the security boundary.
- Department resources are not added to the global `/resources` page.

Primary file:

- `src/pages/GroupPage.tsx`

### Gap 5: Department Activity Insights

- Added an aggregate-only `get_group_activity_insights` RPC restricted to active scoped department admins.
- Added dashboard cards for:
  - Active Members
  - Pending Requests
  - Department Content
  - Invite Acceptance
  - Students
  - Alumni
  - Recent Activity
- Department Content counts linked posts, events, and projects.
- Invite Acceptance is accepted invites divided by accepted plus pending invites; revoked invites are excluded.
- Student and alumni counts use active department members and `profiles_public.graduation_status`.
- Recent Activity counts qualifying actions from the last 30 days on content linked to the selected department.
- Qualifying recent activity includes department posts, events, projects, post comments, project saves, project-role applications, opportunity applications, and saved department jobs/resources.
- Recent activity currently counts actions only from users with an active `group_members` record. A department admin counts only when they are also an active department member.

Relevant migration:

- `supabase/migrations/20260918160000_add_group_activity_insights.sql`

Primary files:

- `src/pages/GroupAdminDashboardPage.tsx`
- `src/integrations/supabase/types.ts`

## Manual Verification Completed

The user manually tested and closed each Phase 3 gap in the local environment:

1. Gap 1: department event/project unlinking, creator retention, private reset, drawer behavior, notification link, and audience controls.
2. Gap 2: admin draft access, member draft denial, non-member denial, and publication behavior.
3. Gap 3: department-admin resource create, edit, publish/unpublish, and delete controls.
4. Gap 4: member-facing published resource library and department scoping.
5. Gap 5: department dashboard insights and non-admin denial for the aggregate RPC.

Automated verification performed during implementation:

- `npm run typecheck` completed successfully after the Gap 5 UI integration.

## Open Questions And Follow-Ups

1. The database permits scoped department admins to update `group_invites` to `revoked`, but the dashboard currently has no Revoke invitation action. Revoked rows are already excluded from the invite-acceptance metric.
2. Decide whether activity by a department admin who is not also an active department member should count. The current MVP counts active-member activity only.
3. Connections are not included in Recent Activity because a global connection cannot currently be attributed reliably to one department.
4. Deeper post/show history remains out of scope, matching the founder document's direction to develop it later.
5. Events/auditions, ticket distribution, and bulk-email feature expansion remain outside Issue #100's approved MVP scope.

## Issue State

Do not close Issue #100 automatically. GitHub issue management remains with the repository owner.
