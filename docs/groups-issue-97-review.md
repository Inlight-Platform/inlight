# Groups Issue #97 Review

Date: 2026-09-15

Scope: Bulk email invites and email-based auto-join for department group members.

Environment verified before implementation:

- Local app: `http://127.0.0.1:8080`
- Local Supabase API: `http://127.0.0.1:54321`
- Local database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Local email inbox: `http://127.0.0.1:54324`
- `.env.sandbox.local`: `VITE_SUPABASE_PROJECT_ID=local`
- Hosted `.env` was not used.

## Implemented

- Added `group_invites` for group-scoped invitation records.
- Added email-based signup claiming through `claim_group_member_invites_for_user`.
- Extended `claim_invites_on_signup` and the auth signup trigger to claim pending group member invites.
- Added `create_group_member_invites` for bulk invite creation.
- Existing platform users are immediately added to `group_members`.
- New users receive pending `group_invites` records.
- Pending group invites are linked to `platform_invites` so invited non-.edu emails can sign up.
- Added `send-group-member-invites` Edge Function.
- Local email delivery uses Mailpit when `RESEND_API_KEY` is absent and the Supabase/site URL is local.
- Added scoped dashboard UI for bulk paste invites.
- Added `.csv`/`.txt` upload into the same bulk invite field.
- Added group-scoped invite history under the group dashboard Invites tab.
- Added `parseBulkEmails` utility and focused tests.

## Manual Results

- Bulk RPC accepted multiple emails in one action.
- Invalid emails are reported.
- Duplicate emails are reported and skipped.
- Existing users are added to `group_members`.
- New emails create pending `group_invites`.
- Pending group invites are linked to `platform_invites`.
- Non-admin RPC access is blocked with `Only group admins can invite members`.
- Mailpit received the local invite email from `send-group-member-invites`.
- Signing up with an invited email auto-created group membership.
- `/feed` showed the private group tab for the auto-joined user.
- CSV upload skips common email headers and still reports invalid rows.

## Acceptance Criteria Status

- Group admins can paste multiple emails and submit in one action: complete.
- UI validates, normalizes, deduplicates, and reports invalid/duplicate emails: complete.
- Existing users with matching emails are added or invited per the state model: complete; existing users are added as active members.
- New users signing up with an invited email become active members: complete for the chosen MVP policy, `membership_status_on_accept = active`.
- Invitation records are group-scoped and visible only to that group's admins: complete via group-scoped RLS and dashboard filtering.
- Existing platform invite email delivery is reused or extended: complete; group invites create/link `platform_invites` and reuse the local Mailpit pattern from platform invite delivery.
- Group tab appears for newly accepted/auto-joined members with no manual badge assignment: complete in manual testing.

## Remaining Gaps

- The dashboard invite UI currently sends `membershipStatusOnAccept: active` only. A future policy toggle could support pending-on-signup if departments need manual approval after invite acceptance.
- Invite revocation/resend controls are not yet exposed in the dashboard.
- The Edge Function was typechecked indirectly through app typecheck, but `deno check` could not run in this shell because `deno` is not installed.
- Full end-to-end browser automation was not added; this pass used manual localhost testing as the gate.

## Verification Commands

- `npm run typecheck`
- `npm run test:run -- src/lib/groupInviteEmails.test.ts`
