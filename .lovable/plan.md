## Goal

Allow anyone to browse Industry Now (theatre / film / music shows) and click out to purchase tickets without signing into Inlight.

## Changes

### 1. Public route

In `src/App.tsx`, move `StageWhisperPage` out of the `AppShell`/`RequireAuth` block and register it as a public route:

```
<Route path="/industry-now" element={<StageWhisperPage />} />
```

Keep the existing in-app entry point working — anywhere that links to `/stage-whisper` will be updated/aliased to `/industry-now` (or we add both routes pointing to the same page). Authenticated users still see it inside the shell via a second route under `AppShell`.

### 2. Standalone layout for logged-out visitors

`StageWhisperPage` currently relies on `PageLayout` (sidebar + bottom nav) being wrapped around it. For the public version:

- Detect `user` from `useAuth()`. If no user, render a lightweight standalone wrapper (Inlight logo + page title only, no sidebar, no links into the rest of the app, optional "Sign in" button in the corner).
- If a user is signed in, behavior is unchanged (still works inside the existing shell route).

### 3. Hide login-only actions for guests

Inside the page, conditionally hide controls that require an account:
- "My List" / saved shows toggle and heart-save buttons
- "Add show / film / music" buttons (admin/auth only — already gated, just confirm)
- Admin delete controls (already gated by `isAdmin`)

Browsing, searching, filtering, "Surprise Me", and the detail sheets remain fully available.

### 4. Ticket purchases

Tickets in Industry Now are external links (`ticket_url` on shows, films, and user-submitted music shows) — clicking opens the third-party box office (TodayTix, venue site, etc.). No Inlight auth is needed for those, so this already works for guests once the route is public. No Stripe/checkout changes required.

### 5. Database (RLS) access for `anon`

The page reads from these tables:
- `nyc_shows`
- `film_metrics`
- `user_films` (active only)
- `user_music_shows` (active only)

Add a migration granting `SELECT` to the `anon` role and adding SELECT policies scoped to `is_active = true` rows (where applicable) so anonymous visitors can fetch the listings. No write access for `anon`.

### 6. Sharing

Add a small "Copy public link" button in the header for any visitor (copies `https://inlight.social/industry-now`).

## Files

- Edit `src/App.tsx` — add public `/industry-now` route outside `AppShell`.
- Edit `src/pages/StageWhisperPage.tsx` — guest-aware layout, hide auth-only UI, add copy-link.
- New migration `supabase/migrations/<ts>_public_industry_now.sql` — `anon` SELECT grants + policies on the four tables above.

No new dependencies. No changes to ticket checkout flows.
