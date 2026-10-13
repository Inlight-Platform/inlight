# Public Post and Event Browse Security

Scope: `posts_public_browse` and `events_public_browse`. Three of the original
fourteen view findings remain after this fix: opportunities, project roles,
and projects. Previous fixes are unchanged.

## Security Boundary

The existing public views show only `visibility = 'public'` content and omit
creator `user_id`. Signed-in feed readers continue using the source tables and
their existing RLS. Public-profile activity RPCs retain their signatures and
public-only filtering. Approved Stop 04 author attribution remains unchanged.
This fix does not change profile-visibility rules, paid-event fields, RSVPs,
ticketing, or anonymous access to unlisted event details. Unlisted events remain
excluded from these discovery views, as before.

Definer views use their creator's privileges instead of caller RLS. Supabase's
recommended invoker option is documented at
https://supabase.com/docs/guides/database/views. Simply changing that option
breaks signed-out reads because anon has no source-table SELECT grant.
Granting anon source access would expose creator IDs.

This migration stores only explicit public columns and public rows in sanitized
read-only RLS projections. A private, non-client-callable trigger synchronizes
them. Public-to-non-public transitions remove the projection row immediately;
non-public content is never backfilled or stored there. Source grants/policies
and existing public-profile RPCs are not modified.

## Local Tests

```sh
node scripts/test-public-feed-security.mjs
node scripts/test-public-feed-security.mjs --naive
node scripts/test-public-feed-security.mjs --fix
```

Baseline passes; naive conversion fails with `permission denied for table posts`;
fix passes. The runner reconstructs the relevant audience/browse baseline from
the repository inside the disposable local database on port 54322. The newer
event audience constraint is also reconstructed because the local database
predates group/private events. All schema, fixtures, mutations, and truncation
roll back. Do not run fixture or mutation files on hosted environments. The
runner assumes this new migration is not already installed in the local DB.

Coverage includes public data/column compatibility; anonymous reads and denied
raw reads; creator-ID omission; network/group/specific/private/unlisted
exclusion; private-source isolation for unrelated users; owner private reads;
unauthorized edits/deletes; live inserts/edits/deletes; publish/withdraw cycles;
public-profile RPC filtering; future private fields; primary-key changes;
projection/trigger privileges; and truncate cleanup.

## Sandbox Manual Tests

1. Confirm `20261013160000_public_feed_invoker_views.sql` succeeds in sandbox.
2. Signed out, open `/feed` and `/feed?tab=events`, then refresh each. Existing
   public posts/events should load with unchanged text, images, dates, and links.
   In Network, public browse requests must not fail with 403/42501. Their JSON
   must not contain creator `user_id` or non-public rows. Landing Stop 04 cards
   remain attributed by their separate approved RPC; do not expect them to lose
   names/photos.
3. With sandbox account A, create a clearly labeled public post and a public
   event. Record their IDs from Network. Signed out, refresh the relevant feed
   and A's `/profile/ACCOUNT_A_UUID`; public activity should appear. Public event
   details at `/events/EVENT_ID` should still load according to existing behavior.
4. As A, edit the post text and event title/date using the existing controls.
   Signed-out refresh must show the edits. Signed-in unrelated non-admin B may
   read public content but must not gain A's edit/delete controls.
5. Verify public-to-network withdrawal and network-to-public publication. If
   the current editor does not offer audience changes, use the sandbox SQL
   Editor on ONLY the two recorded test IDs:

```sql
update public.posts set visibility = 'network' where id = 'SANDBOX_TEST_POST_UUID';
update public.events set visibility = 'network' where id = 'SANDBOX_TEST_EVENT_UUID';
-- Refresh signed out: these IDs must disappear from feed/profile public activity.
update public.posts set visibility = 'public' where id = 'SANDBOX_TEST_POST_UUID';
update public.events set visibility = 'public' where id = 'SANDBOX_TEST_EVENT_UUID';
-- Refresh signed out: the public items must return.
```

6. Existing network/group/specific content must stay absent signed out. An
   unrelated B without the applicable relationship/access must not see it in
   signed-in source reads either. A should retain the existing private/network
   access rights; group access still follows existing membership policies.
7. Delete ONLY the sandbox test post/event using A's available controls or the
   sandbox SQL Editor with their exact IDs. Signed-out refresh must remove them.
   Check signed-in ordinary feed and owner event dashboard reads for regressions.

## Hosted Read-Only Checks

Run the ENTIRE `supabase/tests/public_feed_hosted_readonly.sql` in the target
Supabase SQL Editor as database administrator. It requires no placeholders and
performs no data mutations. Expected result: `Public feed checks passed`, with
public post/event counts, and no errors. It checks view options, exact allowed
column lists, source/projection field parity, anonymous row counts, denied raw
source access, and lack of anon/authenticated projection write grants.
Zero counts are acceptable for empty environments but do not verify UI content.

To confirm owner/unrelated private-source reads, use an existing A-owned NETWORK
item, not group-only content (which has separate membership rules):

```sql
begin read only;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ACCOUNT_B_UUID', true);
select count(*) from public.posts where id = 'ACCOUNT_A_NETWORK_POST_UUID';
-- Zero for unrelated non-admin B with no mutual network relationship.
select set_config('request.jwt.claim.sub', 'ACCOUNT_A_UUID', true);
select count(*) from public.posts where id = 'ACCOUNT_A_NETWORK_POST_UUID';
-- One for the owner.
rollback;
```

Repeat with `events` and an A-owned network event. Use each environment's own
UUIDs. Source identities remain intentionally available to authorized signed-in
readers; only the public browse projections omit them.

Re-run Security Advisor. These two view findings should disappear with no new
security findings. The remaining three findings are handled in later fixes.

## Production Preview

After sandbox confirmation, run Supabase Database Migrations on
`codex/public-feed-browse-security` with Apply unchecked first. Inspect the
pending list before an approved Apply run. Production preview deployment alone
does not apply this migration without the existing gate.

Repeat signed-out feed/event/profile and signed-in read-only checks on the
production-data preview. Run the hosted read-only SQL and Advisor checks above
using production data. Do NOT create/edit/delete items, change visibility, RSVP,
purchase tickets, or run fixture/truncate files in production for these tests.
Do not merge until both environment checks are confirmed.

The migration briefly blocks post/event writes during atomic backfill. Normal
writes synchronize automatically. Imports/restores that disable triggers must
backfill the public projections before app traffic resumes; non-public rows
must never be copied into them.
