## Faculty Mode + Strasberg Group — Demo Plan

Build a faculty role for Inlight, seed Annie as the Strasberg faculty member, and add a private "Strasberg" feed tab that only group members see.

### 1. Database (one migration)

- Extend `app_role` enum with `faculty`.
- New table `groups` — slug, name, description, faculty-owner reference. Seed one row: `strasberg`.
- New table `group_members` — group_id, user_id, status (`active` / `pending`), joined_at. Unique on (group_id, user_id).
- Extend `posts` visibility check to support `group` audience:
  - New table `post_groups` (post_id, group_id) — analogous to `post_recipients`.
  - Update the `can_view_post` SECURITY DEFINER function: if visibility = `group`, viewer must be an active member of one of the post's groups (or the post owner, or faculty owner of that group).
- SECURITY DEFINER helpers:
  - `is_group_member(_user, _group)` — active membership check (avoids RLS recursion).
  - `is_group_faculty(_user, _group)` — owner check.
  - `auto_join_strasberg_by_badge()` trigger on `profiles` insert/update: if `badges` contains "Strasberg", insert active membership.
- Backfill: insert active memberships for every existing profile whose badges include Strasberg.
- RLS on `groups` / `group_members` / `post_groups`:
  - Members read their group + roster.
  - Faculty owner can insert/delete members, delete any post tagged to their group.
- Grant Annie the `faculty` role and set her as `strasberg` owner (looked up by email `819annietmail@gmail.com`; skipped gracefully if the auth user doesn't exist yet).

### 2. Auth page

- Add a small "Faculty login" link/tab next to the existing sign-in form on `AuthPage`. It swaps the heading + helper copy to "Faculty sign-in" but reuses the same email/password fields and `signIn()` call — no separate flow.
- After login, role detection in `useAuth` / a new `useFaculty()` hook drives the UI.

### 3. Faculty profile affordance

- On `ProfilePage`, when viewing own profile AND `useFaculty()` returns a managed group, render a "Manage Strasberg Group" button below the header. Clicking routes to `/groups/strasberg`.

### 4. Strasberg group page (`/groups/:slug`)

New `GroupPage.tsx` (gated to members + faculty):

- Header with group name, description, member count.
- Tabs: **Feed**, **Members**, and (faculty only) **Manage**.
- Feed: list of posts tagged to this group, newest first, using existing `FeedItem` rendering. Faculty sees a "Delete" button on every post; students only on their own.
- Members: roster of active members (avatar, name, role).
- Manage (faculty): pending admit requests with Approve/Deny, and a "Remove" action on active members. Includes a small "Invite by email" input that creates an active membership if the user exists.

### 5. Home page "Strasberg" tab

- In `FeedPage`, if the current user is an active member of `strasberg`, render a new tab labeled **Strasberg** alongside You / All / Events / Projects / Services.
- The tab queries posts where `post_groups.group_id = strasberg` AND viewer can see them. Posts here may be `visibility = 'group'` (private to Strasberg) or `'public'` (toggled public but still tagged to the group).
- Faculty sees the same feed plus per-post moderation: Delete, and a "Make Public ↔ Strasberg only" toggle that flips `posts.visibility`.

### 6. Post composer audience selector

- Extend `AudienceSelector` with a `Strasberg only` option, visible only to active Strasberg members. Selecting it sets `visibility = 'group'` and inserts a `post_groups` row for strasberg on submit.
- Existing Public/Network/Specific options stay unchanged. Posting from anywhere on the site can target Strasberg this way (answer to the audience-selector question).
- A small "Also share with Strasberg" checkbox appears on Public/Network posts so faculty/students can cross-post.

### 7. Routing

- Add `/groups/:slug` route inside the authenticated `AppShell` in `App.tsx`.
- Add a `RequireGroupMember` wrapper that redirects non-members back to `/feed`.

### Technical notes (for the dev side)

- `can_view_post` rewrite must stay `SECURITY DEFINER` and use the new helpers to avoid RLS recursion on `group_members`.
- `post_groups` insert policy: post owner only, and only for groups they're an active member of.
- Faculty role check uses the existing `has_role(uid, 'faculty')` pattern; group ownership is enforced via `is_group_faculty` rather than role alone (so future faculty don't get cross-group powers).
- Seeding Annie's role/ownership runs in the migration using `DO $$ ... $$` with an email lookup against `auth.users`; logs a NOTICE if her account isn't found yet so the migration still succeeds.
- No changes to existing student profile UI beyond the new "Manage Strasberg Group" button (gated on faculty + ownership).

### Out of scope for this demo

- Approval-before-publish moderation queue.
- Multi-group faculty management UI (hard-coded to Strasberg for now; schema supports more).
- Email notifications for admit requests.