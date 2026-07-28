# Copilot Test Generation Prompt

Use this prompt with GitHub Copilot coding agent or Copilot Chat in this repository.

```text
Create a practical automated test suite for this Vite React TypeScript app and wire it into GitHub Actions.

Goal:
Prevent common production regressions before they reach the published main URL, especially auth failures, invisible feed posts, missing projects, broken saved projects, Supabase config mistakes, and route/build errors.

Current repo context:
- The app is Vite + React + TypeScript.
- Supabase is configured in src/integrations/supabase.
- Auth logic lives mainly in src/hooks/useAuth.ts, src/pages/AuthPage.tsx, src/components/layout/RequireAuth.tsx, and src/pages/AuthResetContinuePage.tsx.
- Feed/project surfaces live in src/pages/FeedPage.tsx, src/pages/ProjectsPage.tsx, src/pages/ProjectDetailPage.tsx, and related components under src/components/feed and src/components/projects.
- Existing CI workflow is .github/workflows/ci.yml.
- Existing smoke checks are in scripts/smoke-critical-paths.mjs.
- Existing blocking CI command is npm run test:ci.
- Lint is currently advisory because the repo has pre-existing lint debt.

Please do the following:
1. Add an appropriate test framework for Vite React TypeScript, preferably Vitest + React Testing Library for unit/component tests.
2. Add any needed config/setup files, such as vitest config and test setup.
3. Add package scripts:
   - test
   - test:run
   - test:coverage if coverage is configured
4. Update npm run test:ci so it runs the new tests, the existing smoke checks, typecheck, Supabase config verification, and production build.
5. Update .github/workflows/ci.yml so GitHub Actions runs the new tests and uploads or summarizes test results where practical.
6. Keep tests deterministic. Mock Supabase and browser APIs. Do not call production Supabase from automated tests.
7. Add focused tests for these critical paths:
   - Protected routes redirect anonymous users to /auth.
   - Auth initialization handles code exchange and hash-token recovery.
   - Password recovery mode is detected and reset UI is reachable.
   - Feed queries posts, projects, and events, then filters out items without visible creator profiles.
   - Feed and project saved-state queries are scoped to the signed-in user.
   - Projects are split between active and archived status buckets.
   - Project detail queries are scoped by projectId.
   - Project public/private visibility toggle updates is_public.
   - Supabase config remains locked to the expected project and rejects retired hosts.
8. Preserve existing behavior. If a test reveals a bug, fix the bug and keep the test.
9. Run npm run test:ci locally and include any remaining limitations in the final summary.

Acceptance criteria:
- New test files are committed under sensible locations such as src/**/__tests__ or src/**/*.test.ts(x).
- GitHub Actions shows the test run in the Actions tab on every push and pull request.
- npm run test:ci passes locally.
- No production credentials are required.
- The test suite is small enough to maintain but strong enough to catch the recurring auth/feed/project regressions.
```

Important: the GitHub Actions tab shows workflow runs and test output. The actual test files will appear in the repository diff and pull request files tab.

