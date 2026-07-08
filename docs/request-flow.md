# Request Flow

How traffic, auth, data requests, storage, and edge functions move through Inlight.

## Browser app flow

```text
User opens route
  |
  v
React Router selects page
  |
  v
Public route or authenticated app shell
  |
  v
Feature component calls hook
  |
  v
Supabase JS query, RPC, storage call, or edge function invoke
  |
  v
Supabase Auth session + RLS policies decide access
  |
  v
React Query cache and UI update
```

## Auth initialization

1. `useAuth` starts on app load.
2. It checks URL query/hash parameters for recovery codes and invite tokens.
3. It exchanges auth codes or hash tokens for a Supabase session.
4. It stores the session and user in React state.
5. It claims pending platform or project credit invites when possible.
6. It updates state on Supabase auth events.

## Protected route flow

1. The route is nested under `AppShell`.
2. `RequireAuth` blocks unauthenticated users.
3. `OnboardingGate` can redirect users who still need onboarding.
4. `PageLayout` renders the app navigation and outlet.
5. The page loads data through hooks.

## Supabase query flow

1. A feature hook calls `supabase.from(...).select(...)`, `insert`, `update`, `delete`, or `rpc`.
2. Supabase sends the logged-in user's JWT with the request when a session exists.
3. Postgres RLS policies evaluate the user's access.
4. The hook maps database rows into component view models when needed.
5. TanStack Query caches and invalidates results after mutations.

Example areas:

- `useOpportunities` combines canonical opportunities with job-like feed posts.
- `useAuth` manages invite-token claiming and password recovery.
- Project, company, message, event, saved-item, and connection hooks follow the same client-to-Supabase pattern.

## Edge function flow

```text
Frontend invokes supabase.functions.invoke("function-name")
  |
  v
Supabase checks verify_jwt from supabase/config.toml
  |
  v
Edge function validates body and session context
  |
  v
Function calls Supabase admin APIs or external service
  |
  v
Function returns JSON response or error
```

Functions with `verify_jwt = true` require an authenticated user session. Functions with `verify_jwt = false` must validate their own inputs carefully because they can be called without a logged-in user.

## Storage and media flow

1. UI upload components validate or crop media client-side.
2. Hooks or components upload to Supabase Storage.
3. Storage policies decide whether the current user can write the path.
4. Public URLs or stored object paths are saved to tables.
5. UI reads those values for profiles, projects, companies, posts, shows, and staff media.

When debugging media bugs, check both the database row and the storage policy/path.

## Invitation flow

Inlight has multiple invitation paths:

- General platform invites.
- Project credit invites.
- Company staff edit links.
- Showcase join links.

Most invite flows combine a token in the URL, local storage during auth, an RPC or edge function to claim the token, and notification/message UI after acceptance.

## Pull request flow

```text
GitHub issue
  -> branch from main
  -> local change
  -> npm run lint
  -> npm run build
  -> PR with screenshots and test notes
  -> review
  -> merge
```

Do not change shared Supabase behavior without documenting how the allowed and denied paths were tested.
