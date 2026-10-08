# Issue #98 Review: Group Member Directory, Join Requests, And Member Messaging

## Phase 1 Survey

Local environment verified before survey:

- `VITE_SUPABASE_PROJECT_ID=local`
- `VITE_SUPABASE_URL=http://127.0.0.1:54321`

No hosted Supabase project was queried or modified during this survey.

## Existing Group Page And Member Logic

Primary files:

- `src/pages/GroupPage.tsx`
- `src/pages/GroupAdminDashboardPage.tsx`
- `src/hooks/useGroups.ts`

`GroupPage` already resolves a group by slug using `useGroupBySlug()` and calculates private access with `useMyGroups()`. A user can view private group content when they are an active member or scoped group admin. Non-members see basic group details and a private-group panel.

`group_members.status` is currently typed and used as:

- `active`
- `pending`

There is no `invited` status in `group_members`; invited email-based membership is represented separately in `group_invites.status`.

`GroupPage` already includes:

- Request-to-join insert into `group_members` with `status = 'pending'`.
- Pending request display for group admins.
- Active member display for members/admins.
- Admin accept by updating member status to `active`.
- Admin reject/remove by deleting the `group_members` row.
- Group post composer for members/admins.
- Posts and Members tabs hidden from users who cannot view the private group.

`GroupAdminDashboardPage` already includes:

- Join Requests tab under Verification, backed by `group_members.status = 'pending'`.
- Active member list.
- Existing member add by profile search.
- Bulk email invite UI and CSV/TXT upload.
- Email invite list from `group_invites`.
- Group admins list.
- Resources and Insights tabs.

Current gaps seen in existing behavior:

- Admin roster view does not clearly combine active members, pending join requests, and invited emails as one complete roster model.
- Email invites are visible in the Invites tab, but not presented as an "invited members" roster alongside pending/active members.
- Accept/deny/remove exists for pending/active rows, but visible status feedback is generic and should be checked against #98 expectations.
- Request-to-join mechanism exists on `GroupPage`, but the product question about how users find invisible groups remains open and should stay flagged.
- No admin notification mechanism for join requests was found beyond the pending list in the dashboard.

## Group Invites And Auto-Join

Primary files:

- `supabase/migrations/20260915100000_add_group_member_invites.sql`
- `supabase/migrations/20260915101000_claim_group_member_invites.sql`
- `supabase/migrations/20260915103000_link_group_member_invites_to_platform_invites.sql`
- `supabase/functions/send-group-member-invites/index.ts`

`group_invites` stores email-based invites with:

- `group_id`
- `email`
- `token`
- `status`: `pending`, `accepted`, `revoked`
- `membership_status_on_accept`: `active` or `pending`
- `platform_invite_id`
- `accepted_by`
- `accepted_at`

`create_group_member_invites()`:

- Validates and normalizes emails.
- Deduplicates input.
- Adds existing users directly into `group_members` with selected membership status.
- Creates pending group invite records for not-yet-existing users.
- Links to `platform_invites`.

`claim_group_member_invites_for_user()`:

- Finds pending group invites matching the signing-up user's email.
- Upserts `group_members`.
- Marks group invites accepted.

## RLS And Privacy

Primary migrations:

- `supabase/migrations/20260626213810_0c9e5ab2-7055-4d70-9250-b41e36ee7225.sql`
- `supabase/migrations/20260803120000_add_group_admins.sql`
- `supabase/migrations/20260914120000_add_group_author_identity.sql`
- `supabase/migrations/20260914121000_scope_group_access_helpers.sql`
- `supabase/migrations/20260914123000_add_group_resources.sql`
- `supabase/migrations/20260915100000_add_group_member_invites.sql`

Current group metadata policy:

- `groups` are readable by everyone.

Current `group_members` policies:

- Members can view roster rows when they are the row user, an active group member, or group faculty/admin.
- Users can insert their own pending membership request.
- Faculty/admins can add/update memberships.
- Faculty/admins or the user can delete membership.

Important note:

- The roster select policy allows `user_id = auth.uid()`, so a non-member can read their own pending row after requesting access. That is useful for showing "Request pending", but manual RLS testing should distinguish "can read own pending row" from "can read the roster".

Current private content policies:

- `post_groups` select is limited to active members or group faculty/admins.
- `group_resources` select is limited to active members or scoped group admins.
- `can_view_post()` only exposes group posts to members/faculty for `visibility = 'group'`.

Potential conflict/gap:

- New scoped admin helper `is_scoped_group_admin()` is used in newer code, while some older RLS policies still reference `is_group_faculty()`. `is_group_faculty()` was updated to use `group_admins`, so this likely still works, but any new RLS should use the current scoped admin helper consistently unless preserving existing policy style.

## Messages And Direct Message Start

Primary files:

- `src/pages/MessagesPage.tsx`
- `src/hooks/useMessages.ts`
- `supabase/migrations/20260126195410_7c923635-ce56-4e8f-a8de-366072931665.sql`
- `supabase/migrations/20260503193000_move_definer_helpers_private_and_tighten_public_access.sql`

`MessagesPage` supports direct routes:

- `/messages`
- `/messages/direct/:userId`
- `/messages/group/:projectId`

Opening `/messages/direct/<user_id>` starts or opens a direct conversation. If no existing conversation exists, `MessagesPage` fetches that user's `profiles_public` row and allows a new message.

`useMessages()` provides:

- Conversation list.
- Conversation message query.
- `sendMessage` mutation inserting into `messages`.
- `markAsRead`.
- `canMessage()` helper that checks message privacy and mutual connections.

Current gap:

- Group member rows/cards do not currently expose a direct "Message" action.
- `MessagesPage` computes `canSendDm`, but `GroupPage`/dashboard member rows can probably route to `/messages/direct/:userId` and let existing message UI enforce send behavior.

## People > Groups > Explore Data Source

Primary file:

- `src/pages/PeoplePage.tsx`

The Groups section currently has two tabs:

- `Explore`
- `Manage`

`Manage` uses real scoped admin group records from `useMyScopedAdminGroups()`.

`Explore` currently uses the `studios` table, not the real `groups` table. It renders studio cards using:

- `id`
- `name`
- `description`
- `icon`
- `badge_tag`

Clicking a studio currently navigates to:

- `/group?badge=<badge_tag>`

Current gap:

- New admin-created groups do not automatically appear in People > Groups > Explore unless a matching `studios` record also exists.
- #98 added task requires Explore to use real `groups` records and link to `/groups/<slug>`.

## Post-As Identity Dropdown

Primary files:

- `src/components/feed/AuthorIdentitySelector.tsx`
- `src/components/feed/PostCreator.tsx`
- `src/pages/ProjectNewPage.tsx`
- `supabase/migrations/20260914120000_add_group_author_identity.sql`

Database support exists for group author identity:

- `posts.author_identity`
- `posts.author_group_id`
- `events.author_identity`
- `events.author_group_id`
- `projects.author_identity`
- `projects.author_group_id`

`validate_group_author_identity()` enforces that only scoped group admins can post under a group identity.

`PostCreator` passes author identity fields through for:

- Service/update posts
- Event posts
- Opportunity/job posts

`ProjectNewPage` passes author identity fields through for projects.

Current UI behavior:

- `AuthorIdentitySelector` displays personal identity and a generic `Post as group admin` option.
- After choosing group mode, it shows a search box to choose a specific group.

Current gap against latest #98 comment:

- The selector should instead list one direct option per group: `Group admin of <group name>`.
- This should apply across Service, Event, Opportunity, and Project.
- Non-admins should see no group-admin identity options.

## Phase 1 Manual Verification Checklist

1. In local Supabase Studio, confirm `.env.sandbox.local` points to local Supabase (`http://127.0.0.1:54321`) before testing.
2. As a group admin, open `/groups/<slug>` and note the existing Members tab behavior for active and pending users.
3. As the same group admin, open `/groups/<slug>/dashboard` and note the Verification and Invites tab behavior.
4. As a non-member, open `/groups/<slug>` and confirm the page exposes only group existence/details, not posts/resources/member list.
5. In Supabase Studio, inspect `group_members` and verify statuses currently used are `active` and `pending`.
6. In Supabase Studio, inspect `group_invites` and verify invited email rows use `pending`, `accepted`, or `revoked`.
7. In People > Groups > Explore, verify cards currently come from the `studios` table rather than newly created `groups`.
8. In Service/Event/Opportunity/Project creation, inspect the Post as selector and verify it currently uses the generic `Post as group admin` option plus group search.

## Phase 2.1 IA Review: School, Departments, Communities

Product update reviewed:

- People page gets a new `School` category.
- User-facing `Groups` is renamed `Departments`.
- Institutional resources such as TOCD and TUSC, and later clubs like STEBA and DKA, get their own accounts.
- Departments continue to use managed request/invite membership.
- Existing affiliation-based communities remain part of the People IA.

### Part A: Principles

#### Single Responsibility Per Nav Destination

The proposal mostly keeps the People page responsible for "who and what you can connect with at school." That is reasonable if each section is framed as a directory/discovery surface, not as a mixed admin surface.

The risk is that `School`, `Departments`, and `Communities` are all organization-like nouns. If they all sit under People without strong section labels and different card treatments, users may not understand why TOCD is School, Strasberg is Department, and STEBA is Community or club.

Principle status:

- Mostly passes if People is treated as the relationship directory.
- Violates single-responsibility if the same section also becomes the admin console or resource hub.

Recommended interpretation:

- `People` = directory/discovery.
- `School` = official institutional accounts and offices.
- `Departments` = official academic/program portals with membership.
- `Communities` = affiliation or interest-based spaces.
- Admin dashboards remain behind scoped manage links, not mixed into the public directory.

#### Progressive Disclosure

The proposal fits progressive disclosure if the top-level People page shows only broad categories first, then reveals cards and membership actions inside each section.

Good pattern:

- First layer: People, School, Departments, Communities.
- Second layer: cards for accounts/departments/communities.
- Third layer: detail page with posts, resources, members, join/request actions.
- Fourth layer: scoped admin dashboard.

Risk:

- Putting request/invite/admin controls directly into the category landing view will overload People and blur discovery with management.

Principle status:

- Passes if the category pages stay lightweight.
- At risk if membership workflows are exposed too early.

#### Consistent Membership Models Per Section

This is the most important area to keep clean.

Recommended models:

- `School`: follow/contact/account presence; usually no private roster membership.
- `Departments`: request/invite/auto-join membership; private roster/content; scoped admins.
- `Communities`: depending on product decision, either open join or request-to-join, but should not silently share the exact same rules as Departments unless they are truly the same product object.
- `Institutional accounts`: admin-managed official voice, analogous to a Page account, not a member group.

Principle status:

- The proposal passes if `School` accounts are not treated as private groups.
- It will violate consistency if clubs are placed under the same `Departments` model but have different membership/admin expectations.

#### Scalability From 3 Entity Types To 4-5

The proposed IA can scale, but only if `Departments` is not used as a generic replacement for all groups.

Likely next entity types:

- School offices/accounts: TOCD, TUSC.
- Departments/programs: Strasberg, Adler, ETW.
- Clubs/organizations: STEBA, DKA.
- Affiliation communities: student/alumni/cohort/audience tags.
- External partner accounts later: casting partners, employers, venues.

Principle status:

- `School / Departments / Communities` scales better than one broad `Groups` bucket.
- It will not scale if clubs are forced under `Departments`.

Minimal scalable taxonomy:

- `School`
- `Departments`
- `Clubs & Orgs` or `Organizations`
- `Communities`

If product wants only three sections for now, use `Communities` as the temporary home for clubs but keep the data model/type ready to split into `Clubs & Orgs`.

### Part B: Prior Art

#### Campus/Student Engagement Platforms

CampusGroups separates a campus-wide hub from student groups. Its marketing describes an all-in-one campus platform with modules for student engagement, student organization management, campus-wide communication, portals, and campus operations. Its Groups & Membership material explicitly names "student groups," "clubs and organizations," officers, private pages, group permissions, and join/validation settings. Source: CampusGroups overview and Groups & Membership pages: https://www.campusgroups.com/ and https://www.campusgroups.com/product/groups-membership/

Pattern:

- Institutional/campus hub is the umbrella.
- Student groups/clubs/organizations are discoverable and joinable.
- Officers/admins manage group membership, pages, events, and permissions.

Membership model:

- Searchable group directory.
- One-click registration or controlled validation.
- Private pages for group members.

Implication for Inlight:

- `Departments` should not absorb clubs. CampusGroups uses "groups/clubs/organizations" for student-run/community units, while campus services remain part of the broader campus hub/resources.

Modern Campus Involve, formerly Presence, describes itself as a student engagement platform for activities and organizations, with features for students to discover events, join organizations, and for institutions to manage student organizations and engagement data. Modern Campus also describes an "Organization Directory" as a searchable listing of clubs, teams, organizations, and departments. Sources: Modern Campus Involve product page and legacy feature page: https://moderncampus.com/products/student-engagement-and-learning-platform and https://legacy.moderncampus.com/products/involve/engage-more-students.html

Pattern:

- Central branded student engagement portal.
- Organizations are the broad directory object.
- Departments can appear in the directory, but clubs/orgs are not renamed as departments.

Membership model:

- Discover/join organizations.
- Track involvement.
- Staff/admins manage engagement data and events.

Implication for Inlight:

- A future `Organizations` or `Clubs & Orgs` section is a proven pattern.
- `Departments` is best kept for official academic/program portals.

Anthology Engage exposes an `Organizations` tab. Its help states that students search organizations in the explore view; the organization page can show a Join button; join can either auto-add the user or send a membership request to officers depending on settings; restricted organizations may hide the Join button. Source: Anthology Engage Joining an Organization: https://help.anthology.com/engage/en/joining-an-organization.html

Pattern:

- "Organizations" is the user-facing directory.
- Join policy varies by organization settings.
- Officers approve/deny membership requests.

Membership model:

- Auto-join, request-to-join, or restricted/no join button.

Implication for Inlight:

- Departments can use request/invite membership.
- Clubs later may need per-entity join policies instead of inheriting department-only rules.

#### Learning Platforms

Canvas separates institution structure from course/group collaboration. Canvas documentation describes root accounts and sub-accounts as institution hierarchy, often organized by departments, schools, sub-departments, and course type. It also separately describes groups as course/account communities or assignment/project groups with group memberships tying users to groups. Sources: Canvas account hierarchy and Groups API docs: https://community.instructure.com/en/kb/articles/661404-what-is-the-hierarchical-structure-for-canvas-accounts and https://jsums.instructure.com/doc/api/groups.html

Pattern:

- School/department hierarchy is administrative.
- Courses/sections are instructional.
- Groups are collaboration/membership spaces.

Membership model:

- Admin-assigned roles in accounts/sub-accounts.
- Enrollment/sections for courses.
- Group memberships for collaboration.

Implication for Inlight:

- Do not make `School`, `Departments`, and `Communities` the same object just because they all have members/admins.
- Departments can be official units with scoped admin dashboards; communities/clubs are membership spaces.

Blackboard Learn uses Institutional Hierarchy as a flexible node-based model representing colleges, schools, departments, academic programs, and courses. Nodes can delegate administrative responsibilities and reporting without granting full system access. Sources: Blackboard Institutional Hierarchy docs: https://help.anthology.com/blackboard/administrator/en/system-management/institutional-hierarchy.html and related Instructure-hosted Blackboard Ultra guide: https://community.instructure.com/en/kb/articles/662334-how-do-i-enable-institutional-hierarchy-in-blackboard-learn-ultra

Pattern:

- Official institutional units are hierarchy nodes.
- Groups/course memberships are separate concepts.
- Admin responsibility can be delegated per node.

Membership model:

- Administrative assignment to nodes.
- Course/group membership handled separately.

Implication for Inlight:

- Scoped department admins map well to delegated unit administration.
- Clubs should not be modeled as departments unless they have the same institutional authority and privacy rules.

#### Community Platforms

Slack separates workspaces, channels, and user groups. Channels are dedicated public/private spaces for work, while user groups are admin-managed mentionable/member sets that can also add people to default channels. Sources: Slack channel and user group docs: https://slack.com/help/articles/360017938993-What-is-a-channel and https://slack.com/help/articles/212906697-Create-and-edit-user-groups

Pattern:

- Workspace is the container.
- Channels are conversation spaces.
- User groups are identity/permission/notification sets.

Membership model:

- Public/private channel membership.
- Admin-managed user groups.

Implication for Inlight:

- Department membership and post visibility should remain separate from author identity.
- A "School" account can be an official identity without being a private channel/group.

Discord separates servers, channels, roles, and permissions. Its docs describe servers as community spaces, channels as the rooms inside them, and roles/permissions as the access and management layer. Role-exclusive channels allow private spaces for role-bearing members. Sources: Discord server/channel docs and role/permission docs: https://pax.discord.com/community-build and https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions

Pattern:

- Community container.
- Channels for topic/private spaces.
- Roles for membership/access/admin power.

Membership model:

- Join server/community.
- Roles unlock channels and actions.

Implication for Inlight:

- Long-term, clubs/departments/communities may share permission primitives, but the user-facing IA should still name them by purpose.

Facebook separates Pages and Groups. Pages represent an official organization/brand presence; Groups are public/private communities. Facebook simplified group privacy to public/private and separately exposes discoverability as visible/hidden. It states private groups only let members see member lists and posts; it also notes the Pages + Groups overlap can be confusing, which is why Facebook has experimented with combining official voice and group community tools. Sources: Facebook Groups privacy article and community tools article: https://about.fb.com/news/2019/08/groups-privacy-settings/ and https://about.fb.com/news/2021/11/new-tools-in-facebook-groups/

Pattern:

- Page = official account/voice.
- Group = community membership/content space.
- Privacy and discoverability are distinct controls.

Membership model:

- Pages have followers/admins.
- Groups have members/admins/moderators; groups can be public/private and visible/hidden.

Implication for Inlight:

- TOCD/TUSC as institutional accounts align better with Pages than with Departments.
- The open discoverability question for invisible/private departments should be treated as a separate product setting, not bundled into privacy.

LinkedIn separates Pages from Groups. LinkedIn Pages represent organizations, including schools, and can have admins posting official content. LinkedIn Groups are professional communities; public/private groups have different visibility, and private groups can be listed or unlisted. Sources: LinkedIn Page docs and group visibility docs: https://www.linkedin.com/help/linkedin/answer/a545793 and https://www.linkedin.com/help/linkedin/answer/a548061

Pattern:

- Page = official organizational presence.
- Group = member community.
- Group visibility can be public/private/listed/unlisted.

Membership model:

- Pages have followers and admins.
- Groups have members, owners/admins, and visibility settings.

Implication for Inlight:

- `School` institutional accounts should behave like official Pages/accounts.
- `Departments` should behave like private/listed-or-unlisted groups with membership control.

### Part C: Verdict

The proposed `School / Departments / Communities` split mostly matches proven patterns, with one important adjustment.

Verdict:

- `School` for official institutional accounts is sound.
- `Departments` for academic/program portals with scoped admins and managed membership is sound.
- `Communities` for broad affiliation-based spaces is sound.
- Clubs like STEBA and DKA should not live under `Departments` long-term. They should either live under `Communities` temporarily or get a distinct `Clubs & Orgs` / `Organizations` category.

Minimal change to align with proven patterns:

- Use four conceptual entity types in the data/model even if the UI initially shows three:
  - `school_account`
  - `department`
  - `club_org`
  - `community`
- In the People UI, if product wants three buckets now, show:
  - `School`
  - `Departments`
  - `Communities`
- Place clubs under `Communities` only as a temporary display grouping, with copy like "Clubs & communities", or add `Clubs & Orgs` now if product can tolerate one more category.

Potential confusion:

- Renaming user-facing `Groups` to `Departments` fixes department-portal clarity, but it creates a future naming problem for clubs.
- Institutional accounts with their own official voice should not be presented as request-to-join private departments.
- Existing affiliation-based communities should not inherit department admin dashboards unless they truly need Verification, Insights, Resources, and Invites.
- Privacy and discoverability should remain separate decisions. A department can be private but discoverable, private and hidden, or invite-only.

Recommendation for Issue #98 implementation:

- Proceed with `Departments` wording for the current scoped group feature.
- Keep the underlying table name `groups` for now to avoid churn, but add a typed concept in UI/data where practical.
- Do not make the request-to-join entry point decision in #98; continue to flag discoverability as product-owned.
- For People > School, treat institutional resources/accounts as official account cards, not member groups.
- For post-as identity, the future-proof label should use the entity type: `Department admin of <name>` for departments, later `Club admin of <name>` for clubs, and official account identity for School accounts if that feature is introduced.

## Phase 2.2 IA Naming Review

Local environment verified before this review:

- `VITE_SUPABASE_PROJECT_ID=local`
- `VITE_SUPABASE_URL=http://127.0.0.1:54321`

No hosted Supabase project was queried or modified during this review.

### Actual Current People Page Structure

Current code in `src/pages/PeoplePage.tsx` renders three top-level accordion sections:

- `People`
- `Groups`
- `Companies`

Inside `People`, the current tabs are:

- `Explore`
- `Community`
- `Incoming`
- `Sent`

Inside `Groups`, the current sub-tabs are:

- `Explore`
- `Manage` when the signed-in user has scoped admin groups

Current `Groups > Explore` uses the `studios` table, not real `groups` records. Current `Groups > Manage` uses `useMyScopedAdminGroups()`.

Current `Companies` uses `useCompanyFollows()` to fetch rows from `companies`, then renders `CompanyCard` with follow/unfollow behavior and links to `/company/:id`.

### Product Decision: Discoverability

Discoverability is now recorded as a per-group setting, not a global rule.

Each department gets an admin-controlled `Listed in directory` toggle.

- Listed ON, default: the department card appears under the Departments tab. Non-members see the card and a Request to join action. Content, roster, posts, resources, and private tabs stay locked behind approved access.
- Listed OFF: the department does not appear in the directory. The only ways in are admin invite or manual add. Non-members cannot see or request it; members see it on their own views as usual.

Reason on record:

- Request-spam control. Departments that do not want inbound requests can close the door entirely.

Naming rule:

- The toggle is called `Listed in directory`, never `private`.
- Privacy means who sees content.
- Discoverability means who sees the card.
- Copy, UI, and data model should keep privacy and discoverability separate.

Data model note:

- Represent discoverability as its own field, for example `is_listed boolean`, independent of existing privacy fields.

### Option A: Rename Groups To Departments

Option A keeps the current top-level shape close to the existing page and renames the top-level `Groups` accordion to `Departments`.

Likely top-level labels:

- `People`
- `School`
- `Departments`
- `Companies`

Where School would live:

- `School` should be its own top-level accordion/section on People, alongside People, Departments, and Companies.
- It should contain institutional account cards such as TOCD and TUSC.
- It should not live inside `Departments`, because TOCD/TUSC are official offices/accounts, not membership-gated department portals.
- It should not live inside `Companies`, because it is internal school infrastructure, not an external company/employer/production-company profile.

Where Communities would live:

- If Option A only creates `Departments`, then existing affiliation-based communities have no clear top-level home.
- The minimum viable placement is a separate `Communities` top-level accordion.
- If the team does not want another top-level section yet, community-style cards should not be hidden under `Departments`; that would recreate the naming problem.

Principle evaluation:

- Single responsibility: passes for `Departments` because the word describes the current private department portal feature clearly. Fails if clubs or broad communities are later placed there.
- Progressive disclosure: passes if School, Departments, Communities, and Companies are separate collapsed sections.
- Consistent membership models: passes if Departments are request/invite membership and School/Companies are follow/account surfaces. Fails if School or clubs inherit Department-style private roster behavior by accident.
- Scalability: weak. Clubs like STEBA/DKA do not fit the label `Departments`, so another rename/split will be needed.

What breaks when clubs arrive:

- `Departments` cannot honestly contain STEBA/DKA.
- If clubs are put under `Departments`, users will assume clubs are official academic/program units.
- If clubs are put under `Communities`, the current Option A needs that Communities section anyway.
- If clubs get their own top-level section later, the People page grows again, and earlier user training around "Departments replaced Groups" becomes incomplete.

Prior-art alignment:

- CampusGroups, Anthology Engage, Slack, Discord, Facebook, and LinkedIn all preserve a distinction between official accounts/pages/units and member communities/groups.
- Option A aligns with prior art only if `Departments` is kept narrow and does not become the umbrella for clubs/communities.

### Option B: Keep Groups As Umbrella, Add Sub-Tabs

Option B keeps a top-level `Groups` accordion and puts entity-type tabs under it:

- `School`
- `Departments`
- `Communities`
- `Clubs & Orgs` later

Principle evaluation:

- Single responsibility: stronger than Option A if `Groups` is explicitly a directory of school-affiliated collectives/accounts. Weaker if `Groups` is also used to mean the database table, private department portals, and generic clubs.
- Progressive disclosure: strong. A single accordion reveals clear sub-tabs, and users do not need to scan many top-level sections.
- Consistent membership models: can pass if each sub-tab has distinct card copy and actions: Follow for School, Request to join for Departments, Join/Follow for Communities, Join/request for Clubs & Orgs.
- Scalability: strong. Clubs can be added as a new sub-tab with no top-level rename.

Does `Groups` recreate the two-meanings collision?

- Yes, if the label `Groups` is used without explanatory copy. It can again mean "departments", "clubs", "school offices", "private tabs", or "any collection of people".
- No, if the UI treats `Groups` as an umbrella directory label and the sub-tabs carry the precise meaning.

How labels and card copy prevent collision:

- Top-level accordion label: `Groups`
- Top-level description: `Explore school offices, departments, and communities.`
- Sub-tab: `School`
  - Card action: `View account` or `Follow`
  - Copy: `Official school offices and resources.`
- Sub-tab: `Departments`
  - Card action: `Request to join` or `View department`
  - Copy: `Official department portals with member-only posts, roster, and resources.`
- Sub-tab: `Communities`
  - Card action: `View community`
  - Copy: `Affiliation and interest spaces across Inlight.`
- Future sub-tab: `Clubs & Orgs`
  - Card action: `Join`, `Request to join`, or `View org`
  - Copy: `Student-run organizations and clubs.`

Prior-art alignment:

- Option B is closest to CampusGroups, Modern Campus Involve, and Anthology Engage, which use broad organization/group directories with per-organization join controls.
- It also follows Slack/Discord by using a broad container with clearer inner channel/role/group types.
- It avoids Facebook/LinkedIn's Page-vs-Group confusion only if School account cards are visually and behaviorally distinct from Departments.

### Companies Tab Check

Current `Companies` is not a duplicate of `School`.

From code:

- `useCompanyFollows()` fetches from `companies`.
- `CompanyCard` shows name, description, logo/location, and follow/unfollow.
- `CompanyProfilePage` includes owner/staff access, company projects, photos, follows, and profile-like company content.
- The base `companies` table is public-readable and paired with `company_follows`.

Current Companies concept:

- External or production/company-style profiles.
- Follow-based relationship.
- Portfolio/project surface.
- Not membership-gated like Departments.

School category does not conflict if:

- `School` means internal institutional accounts/offices/resources like TOCD and TUSC.
- `Companies` remains external companies, theaters, employers, production entities, or account profiles that are not school offices.

Potential overlap:

- Some school offices may look like company profiles because both are institutional accounts with followers and posts.
- The distinction should be copy and category: `School` is internal to the institution; `Companies` is external/professional-market facing.

### Verdict

Recommended choice: Hybrid B.

Use `Groups` as a top-level umbrella only if the sub-tabs are explicit and the card actions make the membership model obvious. This is the cleanest path for adding clubs later without renaming again.

Exact recommended top-level People page labels:

- `People`
- `Groups`
- `Companies`

Exact recommended Groups sub-tabs:

- `School`
- `Departments`
- `Communities`
- `Clubs & Orgs` later

One-line user-facing descriptions:

- `People`: Find and connect with students, alumni, and collaborators.
- `Groups`: Explore school offices, departments, and communities.
- `Companies`: Follow companies, theaters, employers, and production partners.
- `School`: Official school offices and resources.
- `Departments`: Official department portals with member-only posts, rosters, and resources.
- `Communities`: Affiliation and interest spaces across Inlight.
- `Clubs & Orgs`: Student-run clubs and organizations.

Why not Option A:

- It solves today's over-broad `Groups` label for departments, but it creates an immediate placement problem for School and Communities and a predictable naming break when clubs arrive.

Why not plain Option B:

- A plain top-level `Groups` label by itself is too vague. It needs sub-tabs, section descriptions, and action-specific card copy to avoid the old collision.

Implementation implication for #98:

- Treat current scoped private portals as `Departments`.
- Implement directory listing via `Listed in directory`, separate from content privacy.
- Do not model School accounts as department memberships.
- Do not commit to clubs under Departments; reserve `Clubs & Orgs` as the future category.

### Phase 2.2 Confirmation Checklist

1. Confirm whether the top-level People page should keep three accordions: `People`, `Groups`, `Companies`.
2. Confirm whether the `Groups` accordion should contain sub-tabs: `School`, `Departments`, `Communities`, with `Clubs & Orgs` later.
3. Confirm whether `School` cards are official account cards with follow/view behavior, not request-to-join membership.
4. Confirm whether `Departments` cards use `Listed in directory` to decide whether non-members can see/request them.
5. Confirm whether `Communities` is the temporary home for affiliation-based communities only, not school offices and not official departments.
6. Confirm whether clubs like STEBA/DKA should wait for `Clubs & Orgs`, rather than being placed under `Departments`.
7. Confirm whether `Companies` remains external/professional-market entities and should not include TOCD/TUSC.

### Phase 2.2 Confirmed Product Decision

Confirmed by product owner:

1. Top-level page structure stays three accordions: `People`, `Groups`, `Companies`.
2. `Groups` gets sub-tabs: `School`, `Departments`, `Affiliations` now; `Clubs & Orgs` later.
3. `School` cards are official account cards with follow/view behavior, never request-to-join membership.
4. `Departments` cards use the `Listed in directory` toggle, default ON, for non-member visibility and requesting.
5. `Affiliations` holds affiliation-based spaces only.
6. Clubs wait for a future `Clubs & Orgs` category; nothing clubs-related is included in this build.
7. `Companies` stays external/professional-market; TOCD/TUSC never live there.

Scope addition:

- Rename the top-level navigation item `People` to `Community`.
- This is a label-only change.
- Routes and URLs stay unchanged.
- The existing People page route remains the destination for the Community nav item.

Naming collision rule:

- With the nav item called `Community`, the affiliation sub-tab under `Groups` cannot be called `Communities`.
- The sub-tab is `Affiliations`.
- Copy: `Spaces you're part of through your profile tags.`
- If Phase 3 planning finds a reason `Affiliations` breaks, ask before choosing another name.

Updated structure on record:

- `Community` nav item
  - `People` accordion: Find and connect with students, alumni, and collaborators.
  - `Groups` accordion:
    - `School`
    - `Departments`
    - `Affiliations`
    - `Clubs & Orgs` later
  - `Companies` accordion: Follow companies, theaters, employers, and production partners.

## Phase 3 Implementation Record

All implementation and verification in this phase targeted the local app and local Supabase environment. Migrations were added as local files for manual application. No hosted Supabase environment was intentionally modified.

### Gap 1: Complete Department Roster And Admin Actions

Implemented:

- The Department Admin dashboard presents one roster model with separate sections for active members, pending join requests, pending email invites, and accepted email invites.
- Pending requests have Accept and Deny actions.
- Active members have a Remove action.
- Success feedback distinguishes `Join request accepted`, `Join request denied`, and `Member removed`.
- Roster sections show counts and invite status/date information.
- Admins are automatically active department members and appear in the active member directory.

Follow-up implementation:

- Adding an existing user as an administrator also grants active membership.
- Inviting a not-yet-registered administrator creates a pending admin invitation and sends an email through `send-group-admin-invite`.
- Local email confirmation is enabled so newly invited accounts still complete the normal verification flow.

Primary files:

- `src/pages/GroupAdminDashboardPage.tsx`
- `src/hooks/useGroups.ts`
- `supabase/functions/send-group-admin-invite/index.ts`
- `supabase/migrations/20260916123000_sync_active_group_admin_memberships.sql`
- `supabase/migrations/20260916124000_create_group_admin_invites.sql`
- `supabase/config.toml`

### Gap 2: Roster And Private Content Visibility

Implemented:

- Active members and scoped department admins can read the active roster.
- A requester can read only their own pending membership row so the UI can display `Request pending`.
- Non-members and pending members cannot read another member's roster row.
- Non-members see only basic listed department details and the join-request state/action.
- Member counts, member lists, posts, resources, composer controls, and private tabs remain unavailable without active access.
- Restricted-page copy now says private details are available to active members, since active admins are also members.
- Privacy is enforced in RLS rather than only by hidden UI.

Primary files:

- `src/pages/GroupPage.tsx`
- `supabase/migrations/20260916120000_harden_group_roster_privacy.sql`

### Gap 3: Request-To-Join Mechanism And Notifications

Implemented:

- A listed department can accept a membership request through `request_group_membership()`.
- The request creates or preserves a pending `group_members` row.
- Duplicate pending requests are handled without creating duplicate membership rows.
- Department admins receive a notification for a new join request.
- Notifications link admins to the scoped department dashboard.
- The UI displays `Request pending` after submission.
- `Listed in directory` is a separate `groups.is_listed` field, default ON, independent of private-content access.
- Department admins can toggle listing from the Verification area of their dashboard.
- Unlisted departments do not appear in the directory and therefore provide no directory request entry point to non-members.

Primary files:

- `src/pages/GroupPage.tsx`
- `src/pages/GroupAdminDashboardPage.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/hooks/useNotifications.ts`
- `src/pages/NotificationsPage.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260916121000_add_group_join_request_notifications.sql`
- `supabase/migrations/20260916125000_add_group_directory_listing.sql`

Product decision resolved during Phase 2.2:

- Discoverability is controlled per department by `Listed in directory`.
- Listed departments are the approved request-to-join entry point.
- Unlisted departments are invite/manual-add only.
- Privacy and discoverability remain separate concepts in copy and data.

### Gap 4: Direct Messaging From The Member Directory

Implemented:

- Active member cards include a message action with a platform-themed `Message member` tooltip.
- The action reuses `/messages/direct/:userId` and the existing message hooks/components.
- Active members of the same department may start a direct conversation even when they are not network connections.
- Existing blocks and messaging privacy rules remain authoritative.
- The messaging page preserves the originating group Members tab as its return destination.
- Returning from a conversation restores the Members tab rather than resetting to Posts.

Primary files:

- `src/pages/GroupPage.tsx`
- `src/pages/MessagesPage.tsx`
- `supabase/migrations/20260916122000_allow_group_member_direct_messages.sql`

### Gap 5: Community Directory And Department Administration Navigation

Implemented directory IA:

- The main navigation label is `Community`; its route remains `/people`.
- The page retains the three accordions `People`, `Groups`, and `Companies`.
- Groups now has only `School`, `Departments`, and `Affiliations` tabs.
- The redundant Explore/Manage layer was removed.
- Departments queries real listed `groups` records and links cards to `/groups/<slug>`.
- Newly created groups therefore appear automatically when `is_listed = true`; no hardcoded frontend card is required.
- School remains an empty official-account category for later account work.
- Affiliations continues to use existing profile-tag/studio data.

Implemented administration navigation:

- The scoped navigation destination is named `Department Admin`, distinct from the platform-wide `Admin` destination.
- One administered department opens its dashboard directly.
- Multiple administered departments open `/groups/admin` with cards showing name, description, and active-member count.
- Selecting a card opens the correct dashboard.
- The dashboard badge is `Department admin`.
- Dashboard Back navigation returns to the multi-department card page when that was the origin; direct dashboard access falls back to the department page.
- Navigation carries known admin-group state so transient RPC refresh failures do not incorrectly redirect authorized users to `/feed`.

Primary files:

- `src/App.tsx`
- `src/components/layout/MainNav.tsx`
- `src/pages/DepartmentAdminPage.tsx`
- `src/pages/GroupAdminDashboardPage.tsx`
- `src/pages/PeoplePage.tsx`
- `src/hooks/useGroups.ts`
- `supabase/migrations/20260916125000_add_group_directory_listing.sql`

### Gap 6: Department Author Identity And Audience Selection

Implemented author identity:

- Service, Event, Opportunity, and Project creation share direct identity choices.
- Personal identity remains available.
- Each active scoped admin assignment adds one `Group admin of <department name>` option.
- The generic `Post as group admin` option and secondary identity search were removed.
- Non-admins receive no department-admin identity option.
- Existing `author_identity` and `author_group_id` persistence and database validation remain in use.

Implemented audience targeting follow-up:

- Each department an admin can target appears as a direct audience option using the department name.
- One-department and multi-department admins use the same direct-choice model.
- The generic `Specific Group` option and secondary group search were removed.
- Selecting a department sets `visibility = group` and the corresponding group ID.

Primary files:

- `src/components/feed/AuthorIdentitySelector.tsx`
- `src/components/feed/AudienceSelector.tsx`
- `src/components/feed/PostCreator.tsx`
- `src/pages/ProjectNewPage.tsx`

### Phase 3 Verification Status

Manual verification gates reported by the product owner:

- Gaps 1 through 5 were exercised incrementally, including roster actions, RLS privacy, join requests, messaging, directory behavior, and department-admin navigation follow-ups.
- Phase 3.6 was explicitly reported verified after direct identity and audience choices were implemented.

Automated checks run after the final Phase 3.6 implementation:

- `npm run typecheck`: pass.
- `npm run test:ci`: pass.
- Production build invoked by `test:ci`: pass.
- `git diff --check`: pass.

The test command generated an untracked `test-results/` directory. It was left in place under the no-delete rule.

## Phase 4 Final Review

### Files Touched For Issue #98

Application and UI:

- `src/App.tsx`
- `src/components/feed/AudienceSelector.tsx`
- `src/components/feed/AuthorIdentitySelector.tsx`
- `src/components/feed/PostCreator.tsx`
- `src/components/layout/MainNav.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/hooks/useGroups.ts`
- `src/hooks/useNotifications.ts`
- `src/integrations/supabase/types.ts`
- `src/pages/DepartmentAdminPage.tsx`
- `src/pages/GroupAdminDashboardPage.tsx`
- `src/pages/GroupPage.tsx`
- `src/pages/MessagesPage.tsx`
- `src/pages/NotificationsPage.tsx`
- `src/pages/PeoplePage.tsx`
- `src/pages/ProjectNewPage.tsx`

Local backend changes:

- `supabase/config.toml`
- `supabase/functions/send-group-admin-invite/index.ts`
- `supabase/migrations/20260916120000_harden_group_roster_privacy.sql`
- `supabase/migrations/20260916121000_add_group_join_request_notifications.sql`
- `supabase/migrations/20260916122000_allow_group_member_direct_messages.sql`
- `supabase/migrations/20260916123000_sync_active_group_admin_memberships.sql`
- `supabase/migrations/20260916124000_create_group_admin_invites.sql`
- `supabase/migrations/20260916125000_add_group_directory_listing.sql`

Review record:

- `reviews/issue-98-review.md`

### Final Acceptance-Criteria Verification Checklist

#### Department Admin Roster

1. Sign in as a department admin and open the Department Admin dashboard.
2. Confirm Active members, Pending join requests, Invited emails, and Accepted email invites are separately labeled and counted.
3. Accept a pending request and confirm visible `Join request accepted` feedback and movement to Active members.
4. Deny a different request and confirm visible `Join request denied` feedback and removal from Pending.
5. Remove an active non-self member and confirm visible `Member removed` feedback.
6. Confirm every active department admin has an active `group_members` row and appears in the active roster.
7. Add an existing member as an admin and confirm the operation succeeds without a non-2xx function error.
8. Invite an unregistered admin email, confirm the invitation email arrives locally, complete signup/verification, and confirm active admin membership.

#### Privacy And RLS

9. As an active member, confirm the Members tab and active roster are visible.
10. As a pending member, confirm only basic department details and `Request pending` appear.
11. As a non-member, confirm no member count, roster, posts, resources, composer, or private tabs appear.
12. Query `group_members` as the non-member and confirm other roster rows are denied by RLS, not merely hidden by the frontend.
13. Confirm a requester may read only their own pending row.
14. Query group posts and resources as the non-member and confirm private content is denied.

#### Join Requests And Discoverability

15. With `Listed in directory` ON, confirm the department appears under Community > Groups > Departments.
16. As a non-member, open the listed department and submit Request to join.
17. Confirm exactly one pending membership row is created and the UI shows `Request pending`.
18. Confirm each scoped department admin receives a join-request notification linked to the correct dashboard.
19. Turn `Listed in directory` OFF and confirm the department disappears from the directory for non-members.
20. Confirm an unlisted department remains available to existing members/admins and supports invite/manual-add access.

#### Member Messaging

21. As an active member, open the department Members tab and hover the message icon; confirm the tooltip says `Message member` and matches the platform theme.
22. Start a message with another active member who is not a network connection and confirm sending is allowed by shared department membership.
23. Confirm blocked/privacy-restricted users remain protected by existing messaging rules.
24. Select Back and confirm the original department Members tab is restored.

#### Community Directory And Admin Navigation

25. Confirm the sidebar says Community while the URL remains `/people`.
26. Confirm Community contains the People, Groups, and Companies accordions.
27. Confirm Groups contains only School, Departments, and Affiliations, with no Explore/Manage layer.
28. Create a listed group through the existing platform-admin group flow and confirm it appears automatically under Departments with name, description, and `/groups/<slug>` link.
29. Confirm an unlisted group does not appear for a non-member.
30. As a one-department admin, confirm Department Admin opens that dashboard directly.
31. As a multi-department admin, confirm Department Admin opens department cards with name, description, and active-member count.
32. Open a card, select Back, and confirm the department-card page is restored rather than `/feed`.
33. As a non-admin, confirm Department Admin is absent.
34. Confirm platform-wide Admin and Department Admin remain distinct navigation labels.

#### Author Identity And Audience

35. For Service, Event, Opportunity, and Project, confirm a one-department admin sees exactly one `Group admin of <name>` identity option.
36. Confirm a multi-department admin sees one identity option per actively administered department.
37. Confirm a non-admin sees no department-admin identity options.
38. Publish under each department identity and confirm the selected department is rendered as the author.
39. Confirm the audience menu lists each targetable department directly by name for both one- and multi-department admins.
40. Publish to each department audience and confirm only active members of the selected department can read it.

### Remaining Product/Future Scope

Not included in issue #98 implementation:

- Building real School account records and follow/view behavior for TOCD/TUSC.
- Adding `Clubs & Orgs`; this remains a future category.
- Migrating affiliation cards away from the existing studio/profile-tag source.
- A post-submission approval workflow allowing a non-member partner to request that admins publish content into a department.
- Renaming underlying database tables from `groups`; current user-facing department terminology does not require that migration.

### Final Status

Issue #98 implementation is complete in the local worktree, subject to:

- Applying the six local `20260916` migration files in the target environment through the approved deployment process.
- Deploying/configuring `send-group-admin-invite` where administrator invitation email delivery is required.
- Completing the final checklist above in each target environment after migrations and functions are deployed.
