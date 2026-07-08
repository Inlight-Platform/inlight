# Inlight DevOps Guide

Operational notes for running, deploying, and maintaining Inlight.

## Overview

Inlight is a Vite/React frontend backed by Supabase. The repo contains frontend source, Supabase migrations, Supabase Edge Functions, auth email templates, and local verification scripts.

This document should be updated whenever the active deployment path changes.

## Environments

| Environment | Purpose | Notes |
| --- | --- | --- |
| Local | Developer machine | Runs Vite on port 8080 and connects to configured Supabase project. |
| Shared Supabase project | Auth, database, storage, edge functions | Project ref: `piofmmawwnermvaysonw`. Treat as production-adjacent. |
| Production hosting | Public web app | Document the active host/provider here when confirmed by the team. |

## Supabase configuration

`supabase/config.toml` links the repo to the Supabase project and declares edge function JWT behavior.

Before a build or lint run, `scripts/verify-supabase-config.mjs` checks that `.env.example` and `src/integrations/supabase/config.ts` still reference the locked project URL:

```text
https://piofmmawwnermvaysonw.supabase.co
```

Do not remove this safety check without replacing it with a clearer environment strategy.

## Database migrations

Schema, RLS, RPC, and data changes live in `supabase/migrations/`.

Operational expectations:

- One migration should describe one logical change.
- Migration filenames should be timestamped and descriptive.
- RLS changes must be explained in the PR.
- Backfills or destructive updates need review before running against shared data.
- Generated frontend types should be updated when schema changes affect TypeScript.

## Edge functions

Edge functions live in `supabase/functions/<function-name>/index.ts`.

Current function categories:

- Company account approval, denial, and staff media.
- Email notifications and password reset.
- Platform, project credit, and showcase invites.
- Stripe checkout, ticket checkout, webhooks, and event price creation.
- Analytics and profile view tracking.

For each function change, document:

- Whether JWT verification is required.
- Expected request body.
- Required secrets.
- Manual test route or cURL.
- Expected success and failure responses.

## Secrets

Safe in frontend:

- Supabase URL.
- Supabase publishable key.

Never commit:

- Supabase service role key.
- Stripe secret keys or webhook secrets.
- Email provider API keys.
- Database passwords.
- Personal access tokens.

## Release checklist

Before merging or deploying:

1. Confirm the PR links an issue.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Confirm UI changes on desktop and mobile when relevant.
5. Confirm Supabase migrations, edge functions, and RLS changes have explicit test notes.
6. Confirm `.env.example` contains only safe public values.
7. Confirm no unrelated generated files or local artifacts were committed.

## Runbooks

### App will not build

1. Run `npm run verify:supabase`.
2. Check `.env.example` and `src/integrations/supabase/config.ts`.
3. Run `npm install` if dependencies are stale.
4. Run `npm run lint` to find TypeScript/ESLint issues.

### Users report permission errors

1. Identify the table, RPC, storage bucket, or edge function involved.
2. Reproduce with the same user role or beta group.
3. Check RLS policies in recent migrations.
4. Test both authorized and unauthorized users.
5. Add a migration if the policy is wrong.

### Edge function fails

1. Confirm `verify_jwt` in `supabase/config.toml`.
2. Confirm the caller is authenticated if JWT is required.
3. Check required secrets in Supabase.
4. Inspect function logs in Supabase.
5. Re-run with the smallest request body that reproduces the issue.

### Media upload fails

1. Confirm file type and size constraints in the UI component.
2. Check the storage path being written.
3. Check storage RLS policies.
4. Confirm the saved database URL or object path.
5. Verify the rendered image/video URL in the browser.
