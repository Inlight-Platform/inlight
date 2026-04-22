

## Goal
Generate a complete SQL backup of your Lovable Cloud database (`public` schema) including schema, RLS policies, functions, triggers, and all row data — delivered as a single downloadable `.sql` file.

## What's included

**Schema:**
- All `CREATE TABLE` statements with columns, defaults, constraints
- Custom enum types (e.g., `app_role`)
- All RLS policies (SELECT/INSERT/UPDATE/DELETE)
- All `SECURITY DEFINER` functions (~30 functions including `has_role`, `consume_job_credit`, `can_view_post`, etc.)
- Triggers attached to public tables

**Data:**
- All rows from every table in `public` (profiles, posts, projects, opportunities, events, notifications, connections, messages, credits, tickets, RSVPs, job_post_credits, etc.) as `INSERT` statements

## What's NOT included (and why)
- `auth.users` rows — managed by Supabase auth, not exportable from public schema. Users will need to re-register or be migrated via the Supabase Admin API separately.
- Storage bucket files (`profile-media` contents) — these are S3 objects, not DB rows.
- Edge function code — already in your repo at `supabase/functions/`.
- Secrets (`RESEND_API_KEY`, `STRIPE_*`, `LOVABLE_API_KEY`) — must be re-added manually to the new project.

## Approach

1. Connect to the managed Postgres via the existing `PG*` env vars in the sandbox.
2. Run `pg_dump` with these flags:
   - `--schema=public` (only public schema, skip internal Supabase schemas)
   - `--no-owner --no-privileges` (portable — won't fail on missing roles in the new project)
   - `--inserts --column-inserts` (data as readable `INSERT` statements rather than `COPY`, easier to restore via SQL editor)
   - `--quote-all-identifiers` (safe restoration)
3. Write the output to `/mnt/documents/database_backup.sql`.
4. Verify the file: row counts per table, file size, and a sanity check on the first/last lines.
5. Surface the file as a downloadable `<lov-artifact>`.

## Restore instructions (will be included as a header comment in the SQL file)

1. Create a new Supabase project.
2. Run the SQL file in the new project's SQL editor (or `psql -f database_backup.sql`).
3. Manually recreate the public storage bucket `profile-media`.
4. Re-add secrets in the new project: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LOVABLE_API_KEY`.
5. Update the hardcoded `supabase_url` and `anon_key` constants inside the `send_notification_email()` and `send_ticket_email()` DB functions to match the new project's URL/key.
6. Migrate `auth.users` separately via the Supabase Admin API (or have users re-register).
7. Re-deploy edge functions from `supabase/functions/` (auto-deployed by Lovable).

## Deliverable

A single file: **`database_backup.sql`** in `/mnt/documents/`, ready to download.

