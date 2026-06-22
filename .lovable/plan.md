## 1. Fix "Save Changes" on the company page

The companies table already has all the new columns (`tagline`, `mission`, `brand_*`, `cover_image_url`, `fun_facts`, etc.) and they're in the generated types — so the schema is fine. To eliminate any flakiness and the `as any` cast that's masking real errors:

- Remove the `as any` from the update payload in `EditCompanyDialog` so TypeScript catches mismatches.
- Verify the companies UPDATE RLS policy allows `owner_user_id = auth.uid()` (and admin). If missing or restrictive, add a migration with a clear "Owners and admins can update companies" policy.
- Invalidate the `['company', companyId]` query on success (currently it just calls `onSaved`) so the page re-renders with the saved values immediately instead of needing a refresh.
- Surface the actual Postgres error in the toast (already partially there) so any future "schema cache" type error is visible, not silent.

## 2. Public, login-free company page

Create a dedicated public route that anyone can visit without an Inlight account, and that does NOT expose the rest of the platform.

**Route**

- New public route `/c/:companyId` (e.g. `/c/dca36794-be45-478e-ac2f-f6e8879492fc` for A Lab Theater).
- Registered OUTSIDE the `AppShell` / `RequireAuth` wrapper in `App.tsx`, alongside the existing public routes (`/showcase/...`, `/preview`, etc.).
- A friendly slug option later is possible, but for now the company ID URL is enough and matches what already exists.

**Page (`PublicCompanyPage.tsx`)**

- Standalone layout — no sidebar, no bottom nav, no Inlight logo linking home.
- Reuses the same hero/branding the owner customized (cover image, logo, palette, tagline, mission, fun facts).
- Sections rendered read-only:
  - Active projects
  - Past / archived projects
  - Photo gallery
  - Staff / management team (cards with name, role, headshot)
- Clicking a project opens a public project view `/c/:companyId/project/:projectId` (read-only project page within the same shell).
- Clicking a staff member opens a public profile view `/c/:companyId/staff/:userId` showing only the public-safe fields (name, headline, role, bio, avatar) — no DMs, no follow buttons, no link out to the broader platform.
- Top bar contains only the company name/logo and (optionally) a small "Powered by Inlight" footer link — no nav into Feed, People, Messages, etc.

**Data access (anonymous reads)**

Anonymous visitors are the `anon` Postgres role. Add a migration that grants minimal SELECT to `anon` and policies scoped only to what's needed:

- `companies`: allow `anon` SELECT for any single company (already largely public).
- `projects`: allow `anon` SELECT WHERE `company_id IS NOT NULL` (only company-linked projects are exposed publicly).
- `company_photos`: allow `anon` SELECT for rows tied to a company.
- `profiles_public` view: allow `anon` SELECT of the safe fields for users who appear as company staff/owners or as members of company-linked projects.
- Project sub-tables (`project_members`, `project_roles`) needed to render team — allow `anon` SELECT only when the parent project is linked to a company.

All other tables (messages, notifications, feed posts, opportunities, etc.) stay locked down — anonymous visitors literally cannot query them.

**Sharing**

In the existing company page (authenticated view), add a small "Copy public link" button next to "Customize Page" so owners can grab `https://inlight.social/c/<companyId>` to share.

## Technical notes

- Files to add: `src/pages/PublicCompanyPage.tsx`, `src/pages/PublicProjectPage.tsx`, `src/pages/PublicStaffProfilePage.tsx`, and one migration `supabase/migrations/<ts>_public_company_anon_access.sql`.
- Files to edit: `src/App.tsx` (new public routes), `src/pages/CompanyProfilePage.tsx` (remove `as any`, invalidate query on save, add copy-link button).
- No changes to `RequireAuth` — we just don't wrap the new routes.
- No new dependencies.
