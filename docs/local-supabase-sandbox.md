# Local Supabase Sandbox

Use this workflow when you need to test product behavior without creating, updating, or deleting rows in the shared Supabase project.

The normal local app (`npm run dev`) is intentionally locked to the shared Supabase project. The sandbox workflow is explicit: it runs Vite in `sandbox` mode and only accepts a local Supabase URL.

## First-Time Setup

1. Install Docker Desktop and make sure it is running.
2. Install dependencies if needed:

```sh
npm install
```

3. Cache the Supabase CLI once if this is your first time using it:

```sh
npx supabase --version
```

4. Start the local Supabase stack:

```sh
npm run supabase:sandbox:start
```

This starts the Supabase CLI containers and writes `.env.sandbox.local` with the local API URL and anon key.

5. Apply or re-apply the local schema from migrations:

```sh
npm run supabase:sandbox:reset
```

6. Start the app against local Supabase:

```sh
npm run dev:sandbox
```

Open http://localhost:8080.

## Daily Use

If Docker is already running and the local Supabase stack exists:

```sh
npm run supabase:sandbox:start
npm run dev:sandbox
```

To inspect local service URLs and keys:

```sh
npm run supabase:sandbox:status
```

To stop the local stack:

```sh
npm run supabase:sandbox:stop
```

To wipe local data and rebuild from migrations:

```sh
npm run supabase:sandbox:reset
```

To update this long-lived sandbox branch with the latest `main` code:

```sh
git checkout local-supabase-sandbox
npm run sandbox:sync-main
```

The sync script fetches `origin/main`, rebases `local-supabase-sandbox` on top of it, and pushes the updated sandbox branch with `--force-with-lease`. If Git reports conflicts, resolve them, run `git rebase --continue`, then push with `git push --force-with-lease origin local-supabase-sandbox`.

## Safety Rules

- Use `npm run dev:sandbox` for destructive or noisy tests, such as creating test events, RSVPing, sending invites, or testing delete flows.
- Do not use `npm run dev` for tests that write data unless you intentionally want to touch the shared Supabase project.
- Do not commit `.env.sandbox.local`; it is generated locally and ignored by the repo.
- Do not add service role keys or private secrets to `.env`, `.env.example`, `.env.sandbox.example`, source files, docs, or PR descriptions.
- The sandbox config only accepts `http://127.0.0.1:54321` or `http://localhost:54321`, so it cannot accidentally point at another cloud database.

## Creating Test Data

The local database starts empty except for whatever migrations create. Create a fresh local account through the app, then create test records through the UI.

For the RSVP flow:

1. Run `npm run dev:sandbox`.
2. Sign up or sign in with a local test user.
3. Create an event in the feed.
4. RSVP to the event.
5. Reload the page and confirm the UI shows the already-RSVPed state.

All of those writes stay inside the local Supabase containers.

## Troubleshooting

If `npm run supabase:sandbox:start` says it cannot connect to Docker, open Docker Desktop and wait until it finishes starting.

If `npm run dev:sandbox` says sandbox mode needs a Supabase URL or key, run:

```sh
npm run supabase:sandbox:env
```

If migrations fail during reset, inspect the failing migration, fix it, then run:

```sh
npm run supabase:sandbox:reset
```
