# Events Admin Bugfix Review

## Scope and Safety

- Worktree: `/Users/clely/Desktop/Inlight/code/inlight-events-bugfix`
- Branch: `events-admin-bugfix`
- Base commit: `a643ac2ae90509b0534c3447d3ece8fea8f417d8`
- Local application: `http://127.0.0.1:8080`
- Local Supabase: `http://127.0.0.1:54321`
- No hosted Supabase project was contacted for implementation or verification.
- The implementation was initially committed, pushed, and opened as a pull request by the user.
- A later CI-only follow-up was committed and pushed by Codex at the user's explicit request.

## Bug A: Existing Events Could Not Be Corrected

### Why it happened

`src/components/admin/EventsManager.tsx` listed all events but only exposed RSVP, scanner, and panelist management. The feed edit dialog could update descriptive fields and images, but it did not expose or update `event_date` or `visibility`. A past event could therefore be difficult to reach from public surfaces and could not be corrected from Admin.

The public landing page also relied only on event RLS when loading its upcoming and past event previews. It did not explicitly restrict those lists to `visibility = public`.

### What changed

#### `src/components/admin/EventsManager.tsx`

- Added an audience badge and event-level Edit action to every Admin Events row.
- Added an edit dialog with a timezone-correct `datetime-local` field.
- Added the supported audience choices: Public, My Network, and Specific People.
- Unknown or obsolete visibility values fall back to Specific People, the most restrictive supported choice.
- Removed Unlisted from the control at product direction.
- Added a Supabase update mutation for `event_date` and `visibility`.
- Invalidates Admin, feed, direct-route event, user-post, and landing-preview query caches after a successful update.

Audience behavior:

- Public events may appear on logged-out Home and signed-in feeds and remain directly accessible.
- Network and Specific People continue to rely on the existing event RLS policy.
- Existing recipient rows are preserved when an event remains Specific People.
- Specific People with no recipients is limited to the event owner and admins by the existing policy.

#### `src/components/scrollytelling.tsx`

- Added `visibility = public` to both public landing-page event queries.
- A future Public event is eligible for logged-out Home.
- Network and Specific People events are excluded from logged-out Home.

#### `src/components/feed/PostCreator.tsx`

- Changed the default audience for new events from Public to Specific People.
- A creator must now select recipients or deliberately choose another audience before the event form is valid.
- This prevents a skipped audience control from implicitly publishing a new event.

#### `src/components/feed/ImageUploader.tsx`

- Centralized the supported image extensions.
- Made `.jpg`, `.jpeg`, and `.png` explicit in both browser file-input `accept` values.
- Preserved every previously supported image format and the existing MIME/extension validation.

### Legacy visibility note

When event visibility was originally introduced, the database migration assigned `public` to existing events. Those rows cannot be reliably distinguished from events deliberately made public later. This change does not bulk-reclassify existing Public events. Admins can now review and change each event through the new controls.

### Manual verification results

- Admin Events displayed an audience badge and Edit action on each row: passed.
- The Sept. 14 event edit dialog opened with the correct local date and time: passed.
- Audience displayed Public, My Network, and Specific People after Unlisted was removed: passed.
- Cancel closed the UI-only dialog without changing the event: passed.
- Saving a future date/time and Public audience succeeded: passed.
- The dialog closed, the row refreshed, and the new values persisted after browser refresh: passed.
- The future Public event appeared in the signed-in events feed: passed.
- The future Public event appeared on logged-out Home: passed.
- Its direct event URL opened while logged out: passed.
- New event creation defaulted to Specific People and required an explicit audience decision: passed.
- `.jpeg` was selectable, uploaded without an unsupported-file error, displayed in preview, and persisted: passed.
- `.jpg` and `.png` regression checks: passed as reported with the complete image hardening checklist.

## Bug B: New Companies Missing from Add Panelist

### Why it happened

The Companies section reads directly from the `companies` table through `src/hooks/useCompanyFollows.ts`. The Add Panelist picker searched only `profiles_public`, with an eight-profile result limit. A newly created company could therefore appear in People -> Companies but could never be returned by the panelist picker.

This was a query-source mismatch rather than a company cache problem.

### What changed

#### `src/components/admin/EventsManager.tsx`

- Added a company-name search against the `companies` table alongside the existing person search.
- Labels search results as Person or Company.
- Gives company matching its own result limit, independent of profile results.
- Selecting a company copies its current name, logo, cover image, location, tagline, description or mission, and website into the panelist form.
- Company panelists use `user_id = null`, so they do not incorrectly link to the company owner's personal Inlight profile.
- Uses the existing `event_panelists` save path and requires no schema migration.

Company details are stored as a snapshot in the panelist row. Later edits to the company page do not automatically rewrite an existing event panelist.

### Manual verification results

- Add Panelist displayed `Find existing Inlight user or company`: passed.
- The newly created company that was previously missing appeared in search: passed.
- The result was labeled Company: passed.
- Selecting it prefilled the available company details: passed.
- It did not receive an Inlight-user association: passed.
- Saving added it to the event panelist list: passed.
- The panelist persisted after refresh: passed.
- Its public panelist page displayed the copied company details: passed.

## Sandbox Preview CI Follow-up

### Why the check failed

The shared sandbox database contained migration-history entries from an unrelated groups branch that were not present in this PR or its base branch. The preview workflow ran `supabase db push` for every PR, including application-only PRs with no migration changes, so Supabase rejected the mismatched history before building the preview.

### What changed

#### `.github/workflows/pr-sandbox-preview.yml`

- Detects whether the PR changes any file under `supabase/migrations`.
- Sets up the Supabase CLI and runs the sandbox `db push` only when migration files changed and a sandbox database URL is configured.
- Emits a clear notice when migration application is skipped for an application-only PR.
- Does not repair, reset, or otherwise mutate hosted sandbox migration history.

## Changed Files

- `src/components/admin/EventsManager.tsx`
- `src/components/feed/ImageUploader.tsx`
- `src/components/feed/PostCreator.tsx`
- `src/components/scrollytelling.tsx`
- `.github/workflows/pr-sandbox-preview.yml`
- `review-events-admin-bugfix.md`

## Checks Run

- `npm run typecheck` completed with exit code 0 after the implementation pieces.
- `git diff --check` completed with exit code 0.
- The updated GitHub Actions workflow parsed successfully as YAML.
- All behavioral confirmation above was performed manually by the user against the local application and local Supabase instance.
