## Goal
Let any user request a company account from their own profile. Admin reviews requests and either approves (which auto-creates the company and assigns the requester as owner) or denies.

## 1. Database — new migration

Create `public.company_account_requests`:
- `id`, `requester_id` (uuid, not null), `created_at`, `updated_at`
- `company_name` (text, not null), `description` (text), `website_url` (text), `justification` (text — "why do you need a company account?")
- `status` (text, default `'pending'`, allowed: `pending` | `approved` | `denied`)
- `reviewed_by` (uuid, nullable), `reviewed_at` (timestamptz, nullable), `admin_notes` (text, nullable)
- `created_company_id` (uuid, nullable — set when approved)

GRANTs: `authenticated` (SELECT/INSERT/UPDATE), `service_role` (ALL). No anon.

RLS policies:
- INSERT: `auth.uid() = requester_id`
- SELECT: requester sees own rows; admins see all (`has_role(auth.uid(), 'admin')`)
- UPDATE: admins only (for approve/deny)

Trigger: `update_updated_at` standard trigger.

Trigger: on INSERT, create a `notifications` row for every admin (type `company_request_new`) so admin gets notified.

Trigger: on UPDATE when `status` changes to `approved` or `denied`, create a notification for the requester (type `company_request_approved` or `company_request_denied`).

## 2. Approval logic

Use a `SECURITY DEFINER` function `public.approve_company_account_request(_request_id uuid, _admin_notes text)`:
- Verifies caller is admin via `has_role`
- Inserts new row into `public.companies` with `name`, `description`, `website_url` from the request and `owner_user_id = requester_id`
- Updates the request: `status='approved'`, `reviewed_by=auth.uid()`, `reviewed_at=now()`, `created_company_id=<new id>`, `admin_notes`
- Returns new company id

And a simpler `deny_company_account_request(_request_id uuid, _admin_notes text)` that just updates status to `denied`.

## 3. User-facing UI

New component `src/components/profile/RequestCompanyAccountDialog.tsx`:
- Triggered by a "Request Company Account" button
- Form fields: Company name (required, max 100), Website (optional), Description (optional, max 500), Why do you need it? (required, max 1000)
- Zod validation, character counters
- On submit: insert into `company_account_requests`; show toast on success
- If user already has a `pending` request, replace the form with a "Your request is being reviewed" status card
- If user has an `approved` request, show "Approved — view your company" link to `/company/<id>`

In `src/pages/ProfilePage.tsx`, on own profile only (`userId === authUser?.id || !userId`), add a small "Request Company Account" button. Placement: in the profile header action row alongside existing edit/settings controls (Building2 icon, ghost variant). Opens the dialog.

## 4. Admin UI

New component `src/components/admin/CompanyRequestsManager.tsx`:
- Lists all requests grouped by status (Pending first, then Approved, then Denied)
- Each row: requester name/avatar (joined from `profiles`), company name, why, website, submitted date
- Pending rows have "Approve" + "Deny" buttons; both open a small confirm dialog where admin can add notes
- Calls the `approve_company_account_request` / `deny_company_account_request` RPCs
- React Query invalidation refreshes the list

Add a new tab in `src/pages/AdminPage.tsx` ("Company Requests", Building2 icon) using the existing tab pattern. Place it next to "Verification".

## 5. Notifications

The existing `notifications` table is used (no schema change). Use `type` values `company_request_new`, `company_request_approved`, `company_request_denied`. Title/body composed in the trigger functions. Link payload (`data` jsonb) carries `request_id` (and `company_id` when approved) so the existing notifications UI can deep-link.

## Technical Notes
- Admin user_id is `802c2c17-c03f-4f0a-9829-96edbecdcd54` (info@inlight.social); detection uses existing `has_role(uid,'admin')` function, not a hardcoded id.
- Companies table currently has no INSERT policy — that's intentional: only the security-definer RPC writes to it, so no broad INSERT policy is added.
- No edge functions or external APIs needed.
- No new dependencies.

## Files Changed
- New migration (table, grants, RLS, triggers, RPCs)
- New: `src/components/profile/RequestCompanyAccountDialog.tsx`
- New: `src/components/admin/CompanyRequestsManager.tsx`
- Edit: `src/pages/ProfilePage.tsx` (add button on own profile)
- Edit: `src/pages/AdminPage.tsx` (add tab)
