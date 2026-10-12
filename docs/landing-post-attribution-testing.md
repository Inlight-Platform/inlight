# Stop 04 Post Attribution

This fix replaces the anonymous post projection used by the landing page with
`get_landing_public_posts()`. The function returns at most four real public
posts, with the most recent eligible post per author. Each post includes its
author's display name, avatar, headline/role, and graduation year.

It excludes hidden profiles, non-public posts, Group-authored posts, blank
names/content, and generated credit announcements. It accepts no user or post
identifier parameters and returns no user UUID, email, membership, or contact
fields. It grants no additional table access. The function uses SECURITY
DEFINER intentionally to expose only this bounded projection, with an empty
search path and execution granted explicitly to anon/authenticated.

The existing security-definer-view findings and project_groups permission
error are separate pending fixes.

## Automated Checks

- `npm run typecheck`
- `npm run test:run -- src/components/tests/TrackStop.test.tsx`
- `npm run build:dev`
- After installing the migration in a disposable database:
  `psql "$SANDBOX_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/landing_post_attribution.sql`

The SQL test inserts synthetic authors and posts, tests anonymous and signed-in
callers, checks exact post/author pairing and avatar matching, excludes hidden
and non-public/group-identity sentinels, and rolls back all fixtures.

## Sandbox Acceptance

1. Confirm the sandbox migration has succeeded in the PR deployment workflow.
2. Open the landing page signed out, hard-refresh, and scroll to Stop 04.
3. With at least four eligible authors in the sandbox, expect four cards.
   Each must show a real author name, their photo (or an initial when they have
   no photo) and their own post text, with no relative-time label. No profile biographies or
   Profile highlight cards should fill missing posts.
4. In Network, find `get_landing_public_posts`. Expect HTTP 200 and at most
   four rows, including creator_name and creator_avatar. Cross-check each post
   id against that author's actual post in the signed-in feed. No user_id,
   email, or contact fields should be returned.
5. In sandbox only, create a new public personal post from a visible account.
   Hard-refresh the landing page: it should replace that author's older post.
6. Create newer network-only and Group-only posts, and a public post using
   Group identity. None may appear in this endpoint or expose the Group
   administrator's personal identity. A hidden profile's post must also stay
   excluded, even when that hidden account is signed in.
7. Repeat at 390px and 320px widths: names must wrap, photos stay visible, and
   all four cards remain reachable while scrolling through Stop 04.
8. Confirm Stops 01-03 and the first fix's five navigation controls and retired
   route redirects still work.

## Production Preview

After sandbox acceptance, explicitly authorize the production migration before
adding the `apply-production-migrations` PR label. The label triggers the
workflow's production database migration step. Until then, production preview
code may show the empty state because the RPC is not installed there.

After that step succeeds, repeat checks 2-4, 7, and 8 using existing production
posts. Compare against real signed-in feed posts; do not create test data in
production. Fewer than four cards is valid when fewer than four authors qualify.
