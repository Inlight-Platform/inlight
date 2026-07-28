# Copilot Instructions

When adding or changing tests in this repository, prioritize production-facing regressions over broad snapshot coverage.

Use the existing app structure:

- Vite + React + TypeScript
- Supabase client in `src/integrations/supabase`
- Auth flow in `src/hooks/useAuth.ts` and `src/pages/AuthPage.tsx`
- Feed and project surfaces in `src/pages/FeedPage.tsx`, `src/pages/ProjectsPage.tsx`, and `src/pages/ProjectDetailPage.tsx`
- Current CI workflow in `.github/workflows/ci.yml`
- Current smoke checks in `scripts/smoke-critical-paths.mjs`

Testing priorities:

1. Authentication: sign in, sign up guardrails, password recovery, invite-token claiming, protected route redirects, and session initialization.
2. Feed visibility: posts, projects, events, profile joins, hidden/archived filtering, and empty states.
3. Projects: creation/edit visibility, saved projects, public/private toggles, project members, links, photos, roles, and detail-route loading.
4. Supabase safety: locked project URL/key expectations, retired host prevention, expected tables/RPC names, and user-scoped queries.
5. Build/runtime safety: TypeScript compilation, route registration, query keys, and production build.

Prefer small, maintainable tests with clear names. Mock Supabase responses instead of calling production data. Do not require production credentials in CI. If a live integration test is useful, gate it behind explicitly named staging secrets and keep it skipped when secrets are missing.

When adding a new test framework:

- Add the required npm scripts to `package.json`.
- Add test config files.
- Add the tests to `.github/workflows/ci.yml`.
- Make sure `npm run test:ci` passes locally.
- Keep lint advisory until the existing lint backlog is cleaned up.

