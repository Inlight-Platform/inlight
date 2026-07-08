# Developer Guide

How to set up Inlight locally, run the app, and validate changes.

## Prerequisites

- Node.js 20 or newer recommended. Node 18 may work, but use the version already expected by the team if one is later pinned.
- npm.
- GitHub access to `Inlight-Platform/inlight`.
- Supabase access if you are changing migrations, RLS policies, storage, or edge functions.
- Optional: Supabase CLI for local database/function work.

## Clone and install

```sh
git clone git@github.com:Inlight-Platform/inlight.git
cd inlight
npm install
cp .env.example .env
```

The checked-in `.env.example` points at the current shared Supabase project:

```sh
VITE_SUPABASE_PROJECT_ID="piofmmawwnermvaysonw"
VITE_SUPABASE_URL="https://piofmmawwnermvaysonw.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_Np7ZYBlXrk0bOtzAGzYW5g_Rfr0xubM"
```

The publishable key is safe for the browser. Do not add service role keys or private secrets to `.env`, `.env.example`, source files, or PR descriptions.

## Start the app

```sh
npm run dev
```

Open http://localhost:8080.

The Vite dev server is configured in `vite.config.ts` with:

- host: `::`
- port: `8080`
- alias: `@` -> `src`

## Required checks

```sh
npm run lint
npm run build
```

Both checks run `npm run verify:supabase` first. That script confirms the code still references the locked Supabase project and has not regressed to an old retired project host.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local Vite server. |
| `npm run verify:supabase` | Confirm required Supabase config is present. |
| `npm run lint` | Run Supabase config verification and ESLint. |
| `npm run build` | Run Supabase config verification and production build. |
| `npm run build:dev` | Build with Vite development mode. |
| `npm run preview` | Preview the latest build locally. |

## Project structure

```text
inlight/
  src/
    App.tsx                         React routes
    pages/                          Route-level screens
    components/                     Reusable UI and feature components
    hooks/                          Supabase and product data hooks
    integrations/supabase/          Supabase client, config, generated types
    lib/                            Shared utilities and policy helpers
    data/                           Static product data
  supabase/
    config.toml                     Linked Supabase project and function auth settings
    migrations/                     Database schema, RLS, and data migrations
    functions/                      Supabase Edge Functions
    templates/                      Auth email templates
  scripts/
    verify-supabase-config.mjs      Config safety check
  docs/
    README.md                       Documentation index
```

## Public and authenticated routes

Public routes include landing/auth, preview, showcase pages, public company pages, company edit token links, Industry Now, and onboarding/plan selection entry points.

Authenticated routes are wrapped by `RequireAuth`, `OnboardingGate`, and `PageLayout`. These include profile, feed, people, network, insights, events, opportunities, messages, notifications, resources, projects, groups, saves, settings, and admin.

## Supabase development notes

Most application behavior is controlled by Supabase tables, RLS policies, storage policies, RPCs, and edge functions. When changing any of those:

1. Add or update a migration under `supabase/migrations/`.
2. Keep edge function code under `supabase/functions/<function-name>/index.ts`.
3. Update generated types only when the schema changes.
4. Test the happy path and permission-denied path.
5. Document the test account, route, and data conditions in the PR.

Edge functions configured in `supabase/config.toml` include notification email, Stripe checkout/webhooks, password reset, platform/project-credit invites, company account approval/denial, analytics, and ticket checkout.

## Troubleshooting

### Supabase config verification fails

Run:

```sh
npm run verify:supabase
```

If it fails, check `.env.example` and `src/integrations/supabase/config.ts` for the locked project URL:

```text
https://piofmmawwnermvaysonw.supabase.co
```

### Local app loads but data is missing

Confirm `.env` exists, the Supabase values match `.env.example`, and your account has access to the relevant beta group or admin role. Many surfaces are intentionally gated by auth, feature access, RLS, or invite state.

### Build fails after schema work

Regenerate or update `src/integrations/supabase/types.ts` if the schema changed, then rerun:

```sh
npm run lint
npm run build
```

### Supabase or GitHub CLI commands fail

Local app development does not require the Supabase or GitHub CLI, but database operations and issue creation do. Re-authenticate those tools before attempting live remote operations.
