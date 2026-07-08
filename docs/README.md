# Inlight Documentation

This documentation describes the active Inlight web app and the workflow new engineers should follow before making changes.

## Getting started

| Document | Description |
| --- | --- |
| [Developer guide](dev-guide.md) | Local setup, environment variables, commands, testing, and troubleshooting. |
| [Contributing](../CONTRIBUTING.md) | Branching, PR expectations, review checklist, and Supabase safety rules. |
| [GitHub issues backlog](github-issues.md) | Curated issue list based on product bug notes and feature requests. |

## System design

| Document | Description |
| --- | --- |
| [Architecture](architecture.md) | Tech stack, source layout, product modules, and key integrations. |
| [Request flow](request-flow.md) | Browser, routing, auth, Supabase client, RLS, edge functions, and storage flows. |
| [DevOps](devops/README.md) | Deployment notes, Supabase operations, runbooks, and release checklist. |

## Quick facts

| Area | Current setup |
| --- | --- |
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS + shadcn/ui/Radix |
| Backend | Supabase Postgres, Auth, Storage, Edge Functions |
| Local port | `http://localhost:8080` |
| Package manager | npm is canonical for scripts and lockfile |
| Main branch | `main` |
| GitHub remote | `git@github.com:Inlight-Platform/inlight.git` |

## Onboarding path

1. Read [dev-guide.md](dev-guide.md) and run the app locally.
2. Open [architecture.md](architecture.md) and identify the feature area you will touch.
3. Pick an issue from GitHub or draft one from [github-issues.md](github-issues.md).
4. Create a branch and make a focused change.
5. Run checks, open a PR, and request review.
