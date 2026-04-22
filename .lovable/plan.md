

## Goal
Generate a complete backup of your Lovable Cloud database (schema + all data) as a downloadable SQL file in `/mnt/documents/`.

## What the backup will include
- All `CREATE TABLE` statements with constraints, defaults, and indexes
- All foreign key relationships
- All RLS policies
- All database functions and triggers
- Custom enum types (e.g., `app_role`)
- **All row data** from every table in the `public` schema (as `INSERT` / `COPY` statements)

## What it will NOT include
- `auth.users` rows (managed by Supabase auth schema; cannot be exported via standard pg_dump from client)
- Storage bucket files (the `profile-media` bucket contents — these are objects, not DB rows)
- Edge function code (already in your repo under `supabase/functions/`)
- Secrets (already listed; must be re-added manually in a new project)

## Approach
1. Run `pg_dump` against the managed Postgres connection with:
   - `--schema=public` (full public schema)
   - Schema + data (no `--schema-only` flag this time)
   - `--no-owner --no-privileges` for portability to a new Supabase instance
2. Write output to `/mnt/documents/database_backup.sql`
3. Verify file size and row counts, then surface as a downloadable artifact

## Deliverable
A single file: `database_backup.sql` in `/mnt/documents/`, ready to download and replay against a fresh Supabase project's SQL editor or via `psql`.

## Restore notes (for migration)
- Run the SQL file in the new project's SQL editor (or `psql -f database_backup.sql`)
- Manually recreate the `profile-media` public storage bucket
- Re-add secrets: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LOVABLE_API_KEY`
- Update the hardcoded `supabase_url` and `anon_key` inside `send_notification_email()` and `send_ticket_email()` DB functions to match the new project
- Users in `auth.users` must sign up again (or be migrated separately via Supabase admin API)

