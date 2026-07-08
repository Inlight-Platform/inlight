# Contributing to Inlight

This repo should stay easy for a new engineer to understand, run, and change safely. Use this workflow for all product work.

## Before coding

1. Read [docs/dev-guide.md](docs/dev-guide.md).
2. Check [docs/architecture.md](docs/architecture.md) for the relevant product area.
3. Pick a GitHub issue or create one from [docs/github-issues.md](docs/github-issues.md).
4. Confirm the issue has a clear scope and acceptance criteria.

## Branching

Start from the latest `main`:

```sh
git checkout main
git pull --rebase origin main
git checkout -b codex/short-descriptive-name
```

Use focused branch names such as:

- `codex/fix-industry-surprise-expired`
- `codex/profile-events-attended-label`
- `codex/opportunities-application-cleanup`

## Local checks

Run the checks that match your change:

```sh
npm run lint
npm run build
```

For Supabase-heavy changes, also inspect the migration/function you touched and document how you tested RLS or edge function behavior in the PR.

## Pull requests

Every PR should include:

- The linked issue.
- A short summary of what changed.
- Screenshots or screen recordings for UI changes.
- The exact commands you ran.
- Notes about any Supabase migrations, edge functions, RLS policies, or environment variables.

Keep PRs small. If a bug note spans multiple features, split it into multiple issues and PRs.

## Supabase safety

The app is currently configured against a shared Supabase project. Treat database, auth, RLS, storage, and edge function changes as production-adjacent work.

- Do not rotate keys or switch Supabase projects without an issue and explicit approval.
- Do not commit service role keys or private secrets.
- Keep schema changes in `supabase/migrations/`.
- Explain any RLS policy change in the PR.
- Test both the allowed path and the denied path for permissions changes.

## Review checklist

- The code follows nearby patterns.
- UI changes work on desktop and mobile.
- Authenticated and public routes still behave correctly.
- Loading, empty, and error states are covered when relevant.
- Checks were run and documented.
- Unrelated files were not reformatted or rewritten.
