# Inlight

Inlight is a creative community platform for students, artists, companies, and projects. The app helps users build profiles, find collaborators, manage projects, post opportunities, share events and shows, message each other, and track credits inside a Supabase-backed React application.

This repository is the main product codebase for the Inlight web app.

## Start here

- [Developer guide](docs/dev-guide.md): local setup, environment variables, commands, and troubleshooting.
- [Architecture](docs/architecture.md): tech stack, codebase layout, auth, data, and major product surfaces.
- [Request flow](docs/request-flow.md): how browser requests, auth, Supabase, edge functions, and RLS interact.
- [DevOps guide](docs/devops/README.md): deployment notes, Supabase operations, runbooks, and release checklist.
- [GitHub issues backlog](docs/github-issues.md): curated issue list from product notes for onboarding engineers.
- [Contributing](CONTRIBUTING.md): branch, pull request, review, and testing expectations.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite, React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Routing | React Router |
| Data fetching | TanStack Query, Supabase JS |
| Auth and database | Supabase Auth, Postgres, Row Level Security |
| Server-side functions | Supabase Edge Functions |
| Payments and tickets | Stripe-related Supabase functions |
| Build and quality | npm, Vite, ESLint |

## Quick start

```sh
git clone git@github.com:Inlight-Platform/inlight.git
cd inlight
npm install
cp .env.example .env
npm run dev
```

The dev server runs on http://localhost:8080.

The app is currently locked to the shared Supabase project configured in `.env.example` and `src/integrations/supabase/config.ts`. See [docs/dev-guide.md](docs/dev-guide.md) before changing Supabase configuration.

## Common commands

```sh
npm run dev              # Start Vite on port 8080
npm run build            # Verify Supabase config and build production assets
npm run build:dev        # Verify Supabase config and build in development mode
npm run lint             # Verify Supabase config and run ESLint
npm run preview          # Preview the built app locally
npm run verify:supabase  # Check that required Supabase host values are present
```

## Local testing before pull requests

All engineers should run the automated checks locally before opening or updating a pull request, especially because multiple people may be working against the same shared Supabase project.

After pulling the latest `main`, install dependencies once:

```sh
npm install
```

For day-to-day test runs:

```sh
npm run test:run
```

Before submitting a pull request, run the same full flow that CI runs:

```sh
mkdir -p test-results
npm run test:ci
```

`npm run test` starts Vitest in interactive watch mode, so use `npm run test:run` or `npm run test:ci` when you want a command that exits.

## Product areas

- Public landing, auth, preview, showcase, company, and Industry Now pages.
- Authenticated app shell with feed, people, network, events, opportunities, messages, notifications, resources, projects, groups, saves, settings, insights, and admin.
- Project creation, project roles, role applications, project invitations, credit invitations, and company account management.
- Supabase-backed storage, RLS, and edge functions for email, invites, analytics, tickets, Stripe, and company approvals.

## How work should flow

1. Pick or create a GitHub issue.
2. Create a feature branch from `main`.
3. Make the smallest focused change that satisfies the issue.
4. Run the relevant checks from [docs/dev-guide.md](docs/dev-guide.md).
5. Open a pull request using the repo template.
6. Get review before merging.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.
