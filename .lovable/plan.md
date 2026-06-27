## Preview the Strasberg faculty account

No code changes needed — the faculty experience already exists. Here's how to view it in the live preview:

### Steps

1. Open the preview and go to `/auth`.
2. Sign in with the demo faculty credentials:
   - Email: `819annietmail@gmail.com`
   - Password: `@Anniet819`
3. Once signed in, you'll land on the normal app shell. From there:
   - **Faculty profile** — click your avatar / go to `/profile/<your-user-id>`. The "Manage Group" button appears for faculty owners (wired via `useMyFacultyGroup`).
   - **Group management page** — click "Manage Group" or go directly to `/groups/strasberg`. This is the `GroupPage` view where faculty admit students and moderate posts.
   - **Strasberg feed tab** — go to `/feed`. A "Strasberg" tab is rendered for group members (faculty + admitted students) showing only posts with `group` visibility scoped to Strasberg.
   - **Posting "Strasberg only"** — open the post composer; the audience selector includes a "Strasberg only" option (via `AudienceSelector` + `availableGroups`).

### If something looks wrong

If after signing in you don't see the "Manage Group" button or the Strasberg feed tab, tell me which one is missing and I'll switch to build mode to fix the gap. Otherwise this is purely a navigation walkthrough — nothing to implement.
