# Issue #101 Review: Group-Scoped Events, Tickets, and Audition Timeslots

## Status

Phase 3 implementation and manual verification are complete for all seven approved gaps. This review does not close GitHub issue #101.

The work was developed against the local application and local Supabase environment. The migrations listed below were applied by the repository owner to local Supabase only.

## Scope Delivered

- Department-scoped events remain private to active members and scoped department admins at the database level.
- Existing public/global event behavior remains separate from department event access.
- Department admins can create free or paid events for their department using the shared post creator.
- Paid department events can be configured through the existing Stripe price flow by an authorized department admin.
- Active department members can RSVP to free department events or enter the existing paid checkout flow.
- Non-members cannot read, RSVP to, purchase tickets for, or inspect attendee data for private department events.
- Department admins can review RSVP and ticket attendance for events linked to their own department and update attendance/check-in state.
- Department pages keep group content inside the department experience, with group-scoped tabs and shareable content paths.
- Department admins can create draft or published auditions with descriptions, materials, and one or more capacity-controlled timeslots.
- Active members and same-department admins can reserve one timeslot per audition and switch to another available slot.
- Capacity is enforced atomically in the database so concurrent reservations cannot overbook a timeslot.
- Department admins can review audition rosters by timeslot with capacity, booked, and available counts.

## Implementation By Gap

### Gap 1: Group Event Access Hardening

- Hardened event reads so group-only events are available only to active members and scoped admins of a linked department.
- Protected direct event queries, RSVP creation, attendee lookup, and paid checkout from non-members.
- Preserved existing public/global event access and ticket behavior.
- Kept `event_groups` as the group association model rather than introducing a duplicate event table.

Relevant migration:

- `supabase/migrations/20260921120000_harden_group_event_access.sql`

Primary server flow:

- `supabase/functions/create-ticket-checkout/index.ts`

### Gap 2: Department Event Creation And Paid Ticket Setup

- Extended the existing event creator for department-targeted events instead of creating a second event form.
- Department admins can create free or paid events linked to the selected department.
- Paid-event price creation is restricted to platform admins or scoped admins of the linked department.
- Stripe price configuration remains on the existing event and ticket model.

Primary files:

- `src/components/feed/PostCreator.tsx`
- `supabase/functions/create-event-price/index.ts`

### Gap 3: Member RSVP And Paid Checkout

- Active department members can use the existing RSVP flow for free group events.
- Authorized members can enter the existing Stripe checkout flow for configured paid group events.
- Checkout rejects inaccessible events before returning a checkout URL.
- Public/global RSVP and checkout behavior remains unchanged.

Primary files:

- `src/components/feed/FeedItem.tsx`
- `supabase/functions/create-ticket-checkout/index.ts`

### Gap 4: Department Attendance And Ticket Review

- Scoped department admins can review RSVP and ticket status only for events linked to their department.
- Added protected RPCs for RSVP attendance and paid-ticket check-in updates.
- Group event drawers expose the event dashboard to authorized department admins.
- Department content opens within the department page rather than redirecting into the global feed.
- Department pages provide All, Events, Projects, Services, Members, and Resources tabs, while Home retains department selector links.
- Group posts, events, and projects have shareable group-scoped paths.

Relevant migration:

- `supabase/migrations/20260921130000_allow_group_admin_event_attendance.sql`

Primary files:

- `src/pages/GroupPage.tsx`
- `src/pages/FeedPage.tsx`
- `src/components/feed/FeedItem.tsx`
- `src/lib/publicPaths.ts`
- `src/App.tsx`

### Gap 5: Audition Builder And Timeslot Foundation

- Added `group_auditions` and `group_audition_timeslots` as department-owned tables.
- Added member-read and scoped-admin management RLS policies.
- Added atomic audition creation requiring a title and at least one valid timeslot.
- Timeslots require an end after their start and a capacity of at least one.
- Added an Auditions tab to the department dashboard.
- Admins can create draft or published auditions and publish or unpublish them later.
- Draft auditions remain visible to their department admins and hidden from regular members.

Relevant migration:

- `supabase/migrations/20260921140000_create_group_auditions.sql`

Primary file:

- `src/pages/GroupAdminDashboardPage.tsx`

### Gap 6: Member Audition Signup

- Added `group_audition_signups` with one signup per user per audition.
- Added a protected booking RPC that locks the selected timeslot before checking capacity.
- Members can switch between available timeslots without creating duplicate audition signups.
- Draft auditions, full timeslots, mismatched audition/timeslot IDs, non-members, and cross-department users are rejected at the database level.
- Added a member-facing Auditions tab to the department page.
- Timeslots display total capacity and remaining availability; a member's own choice is identified with Signed up and Selected states.
- Same-department scoped admins can also reserve a timeslot; other department admins remain denied.

Relevant migrations:

- `supabase/migrations/20260921150000_add_group_audition_signups.sql`
- `supabase/migrations/20260921160000_allow_group_admin_audition_booking.sql`

Primary file:

- `src/pages/GroupPage.tsx`

### Gap 7: Audition Roster Review

- The department dashboard displays each audition's roster grouped by timeslot.
- Each timeslot shows capacity, booked, available, and total signup counts.
- Roster entries show the member's public display name, avatar, signup date, and profile link.
- Signup rows remain private to the signing-up member and scoped admins of the relevant department.
- Admins assigned only to another department cannot read the roster.

Primary file:

- `src/pages/GroupAdminDashboardPage.tsx`

## Manual Verification Completed

The repository owner manually tested and approved each Phase 3 gap in the local environment:

1. Gap 1: group event reads, direct-query isolation, RSVP denial, attendee privacy, and paid-checkout access controls.
2. Gap 2: department event creation, free/paid configuration, Stripe price creation, and unauthorized price-creation denial.
3. Gap 3: authorized free RSVP and paid checkout behavior with non-member denial.
4. Gap 4: scoped attendance review, check-in updates, group-local event navigation, department tabs, and shareable group content paths.
5. Gap 5: audition creation, validation, multiple timeslots, draft/published visibility, publication toggling, and unauthorized creation denial.
6. Gap 6: member and same-department-admin booking, persistence, switching, capacity enforcement, draft denial, and cross-department isolation.
7. Gap 7: timeslot roster display, counts, profile navigation, member privacy, and scoped-admin roster access.

Automated verification performed after the final Gap 7 integration:

- `npm run typecheck` completed successfully.
- `npm test -- --run` completed successfully with 17 test files and 46 tests passing.

## Open Questions And Follow-Ups

1. Members and same-department admins can switch audition timeslots, but there is no action to cancel a signup without choosing another slot.
2. Admins can create and publish/unpublish auditions, but editing audition details/timeslots and deleting auditions are not yet exposed in the dashboard.
3. Audition materials are currently free-form text and may contain instructions or a link; dedicated file uploads were not added.
4. Audition signup confirmation, cancellation, reminder, and roster-change notifications are not included in this MVP.
5. Audition timeslots do not currently prevent admins from entering past dates or overlapping slots.
6. Attendance and ticket review are implemented for department events, but export/reporting tools are not included.
7. Paid checkout depends on valid Stripe test or production configuration outside the database migrations.

## Scope Boundaries Preserved

- Existing public/global event and ticket behavior remains separate from department-only access rules.
- Issue #100 resources and insights behavior was not folded into the event or audition models.
- Issue #99 posting controls and Issue #98 invite flows were reused only where needed for group membership and scoped-admin authorization.
- The implementation does not add deeper post/show history beyond the approved department feed behavior.

## Issue State

Do not close Issue #101 automatically. GitHub issue management remains with the repository owner.
