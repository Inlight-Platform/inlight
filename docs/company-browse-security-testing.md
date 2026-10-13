# Company Browse Security

Scope: `companies_browse` only. Ten other flagged views remain after this fix.

## Why This Fix

The current view runs with its creator's permissions, bypassing source-table
RLS. Its explicit columns already exclude owner UUIDs; baseline tests do not
demonstrate an existing disclosure. Supabase recommends invoker views so caller
permissions and RLS apply: https://supabase.com/docs/guides/database/views.
An invoker-only conversion breaks signed-out browsing because source rows are
owner/admin-only. Broadening source SELECT would expose private owner IDs.

This migration copies only the existing public fields into a read-only RLS
projection and makes the existing view invoker. It reuses the self-only
`catalog_ownership` table and invoker helper from PR #156. A private trigger
synchronizes public fields and ownership. Source grants, source policies,
management/staff-token RPCs, company photos, and project/team RPCs are unchanged.
Companies currently have no hidden/active flag: all company catalog rows remain
public, matching existing behavior. Hidden data here means private source fields
and other users' ownership records, not a newly introduced company visibility rule.

## Local Tests

```sh
node scripts/test-company-browse-security.mjs
node scripts/test-company-browse-security.mjs --naive
node scripts/test-company-browse-security.mjs --fix
```

Expected: baseline passes, naive fails `Anonymous company browse failed`, fix
passes. The runner reconstructs the relevant baseline and PR #156 prerequisite
inside the disposable local Supabase database on port 54322. All schema, fixture,
mutation, and truncate operations roll back. Never run these fixtures against a
hosted database. The runner assumes these new projection migrations have not
already been applied to the local instance.

Coverage: anonymous reads; owner/unrelated ownership flags; raw-row privacy;
unauthorized edits; unowned companies; invoker configuration; projection and
ownership tampering; private trigger execution; future private columns; owner
edits; insert/delete synchronization; ownership transfer/removal; truncate
cleanup without changing other catalogs' ownership records.

## Sandbox Checklist

1. Confirm migration `20261013120000_company_browse_invoker_view.sql` succeeds.
   It requires the already merged `20261013030000` migration from PR #156.
2. Choose a company and record its ID, owner user ID, and a different non-admin
   user ID. Open `/c/COMPANY_ID` signed out; refresh. Name, branding, description,
   photos, staff, and projects should match before the migration. Check Network
   for failed requests. Open `/company/COMPANY_ID` as the owner and unrelated
   user; only the owner should retain normal owner editing controls.
3. In Supabase SQL Editor run these read-only role checks, replacing all three
   placeholders with real UUIDs. Repeat in each environment using its own IDs.

```sql
begin read only;
select set_config('company_test.id', 'COMPANY_UUID', true);
select set_config('company_test.owner', 'OWNER_UUID', true);
select set_config('company_test.other', 'OTHER_NON_ADMIN_UUID', true);
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select id, name, is_owner from public.companies_browse
where id = current_setting('company_test.id')::uuid;
-- One row, is_owner=false.
select count(*) from public.companies
where id = current_setting('company_test.id')::uuid;
-- Zero rows: no owner UUID exposed through the raw table.
select count(*) from public.catalog_ownership where catalog = 'companies';
-- Zero rows.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('company_test.owner'), true);
select is_owner from public.companies_browse
where id = current_setting('company_test.id')::uuid;
-- true.
select set_config('request.jwt.claim.sub', current_setting('company_test.other'), true);
select is_owner from public.companies_browse
where id = current_setting('company_test.id')::uuid;
-- false.
select count(*) from public.companies
where id = current_setting('company_test.id')::uuid;
-- Zero rows.
select count(*) from public.catalog_ownership
where catalog = 'companies' and row_id = current_setting('company_test.id')::uuid;
-- Zero rows.
rollback;
```

4. As the owner, edit a sandbox company's name/description/branding. Refresh its
   signed-out page; changes must appear immediately. Restore original values.
   As an unrelated non-admin, an attempted raw-table update must affect zero rows
   or be rejected; it must not change the page. Direct projection/ownership
   writes must be denied for both accounts. Verify follow/unfollow still works.
5. Confirm the view options, count parity, and private-column boundary:

```sql
select reloptions from pg_class where oid = 'public.companies_browse'::regclass;
-- Includes security_invoker=true and security_barrier=true.
select (select count(*) from public.companies) as source_count,
       (select count(*) from public.companies_public_catalog) as projection_count,
       (select count(*) from public.companies_browse) as browse_count;
-- All three match when run as the database administrator.
select table_name, column_name from information_schema.columns
where table_schema = 'public'
and table_name in ('companies_browse', 'companies_public_catalog')
and column_name in ('owner_user_id', 'created_at', 'updated_at');
-- Zero rows.
```

6. Re-run Security Advisor: `companies_browse` must no longer be reported as a
   security-definer view. Do not expect the remaining ten findings to disappear.
   Check for new security findings as well.

## Production Preview

After sandbox confirmation, run GitHub Actions -> Supabase Database Migrations
on `codex/company-browse-security`, with Apply unchecked first. Inspect the
entire pending migration list before the approved apply run. Do not apply
unreviewed migrations. Production preview deployment alone does not apply this
migration unless explicitly authorized via the existing gate.

The migration atomically backfills company fields while briefly blocking company
writes. Repeat the read-only role/count/column/Advisor checks and signed-out and
signed-in page checks on the production-data preview. Do not create test records,
transfer owners, delete companies, or truncate production data. Confirm before
merging. Restores/imports that disable triggers require projection/ownership
backfill before resuming the app, as with PR #156.
