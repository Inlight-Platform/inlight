# Inlight Architecture

This document describes the current app shape: tech stack, source layout, product modules, and key integrations.

## High-level system

```text
Browser
  |
  | Vite/React app
  v
React Router routes and feature components
  |
  | Supabase JS client
  v
Supabase Auth + Postgres + Storage + Edge Functions
  |
  | RLS policies, RPCs, triggers, external APIs
  v
Email, Stripe, analytics, invitations, tickets, company workflows
```

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend runtime | Vite, React, TypeScript |
| Routing | React Router |
| Server state | TanStack Query |
| UI | Tailwind CSS, shadcn/ui, Radix UI, lucide-react |
| Auth | Supabase Auth |
| Data | Supabase Postgres with RLS |
| Storage | Supabase Storage policies and public media URLs |
| Server functions | Supabase Edge Functions |
| Payments | Stripe-related edge functions |
| Tooling | npm, ESLint, Vite build |

## Source layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Route map, public routes, authenticated app shell. |
| `src/pages/` | Route-level screens. |
| `src/components/layout/` | Page shell, auth guard, onboarding gate, navigation. |
| `src/components/feed/` | Feed cards, post creation, services, surveys, bento/grid cards. |
| `src/components/profile/` | Profile editing, media, credits, attendance, vouching, company requests. |
| `src/components/projects/` | Project creation, roles, applications, timelines, image uploads. |
| `src/components/opportunities/` | Opportunity creation, cards, filters, application flows. |
| `src/components/stage-whisper/` | Industry Now theatre, film, music, show detail, add/edit dialogs. |
| `src/components/messages/` | Direct and group messaging UI. |
| `src/components/invitations/` | Platform and project invitation UI. |
| `src/components/admin/` | Admin management surfaces. |
| `src/hooks/` | Product data hooks built around Supabase and TanStack Query. |
| `src/integrations/supabase/` | Supabase client, locked config, generated database types. |
| `supabase/migrations/` | Schema, RLS, RPC, storage, and data migrations. |
| `supabase/functions/` | Edge functions for server-side operations. |

## Major product surfaces

### Public surfaces

- Landing page at `/`.
- Authentication at `/auth` and `/auth/reset/continue`.
- Preview at `/preview`.
- Showcase pages at `/showcase/...`.
- Public company pages under `/c/...`.
- Company edit token flow at `/company-edit/:token`.
- Industry Now at `/industry-now`.

### Authenticated app shell

Authenticated pages use `RequireAuth`, `OnboardingGate`, and `PageLayout`.

Key surfaces:

- Feed and services.
- Profiles and settings.
- People, directory, network, mutuals, and groups.
- Events, saves, and Industry Now.
- Opportunities and project-linked jobs.
- Projects, project roles, applications, and invitations.
- Messages and notifications.
- Resources, insights, and admin.

## Auth and access model

Supabase Auth provides user sessions. The frontend stores session state through `useAuth`, which also handles:

- Password recovery URLs.
- Platform invite tokens.
- Project credit invite tokens.
- Showcase welcome email scheduling.
- Existing-account signup detection.

Access is enforced in three places:

1. UI guards such as `RequireAuth`, `OnboardingGate`, and feature access hooks.
2. Supabase Row Level Security policies.
3. Edge functions that require JWTs where configured in `supabase/config.toml`.

## Data model themes

The schema is migration-driven. The domain includes users/profiles, posts, events, shows, saved items, projects, project roles, role applications, invitations, opportunities, messages, company accounts, company staff, resources, analytics, and admin workflows.

Use `src/integrations/supabase/types.ts` as the frontend map of the current schema, but treat migrations as the source of truth.

## Edge function themes

Current functions cover:

- Email notifications and auth-related email flows.
- Stripe checkout, webhooks, event prices, and ticket checkout.
- Platform invites and project credit invites.
- Company account approval, denial, and staff media.
- Analytics and profile view tracking.
- Showcase welcome messages.

When changing an edge function, document JWT requirements, expected environment secrets, and manual test steps in the PR.
