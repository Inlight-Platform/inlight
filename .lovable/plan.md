## Goal

Produce everything you need to run this app on your own Supabase project (`piofmmawwnermvaysonw`) **outside** of Lovable Cloud. I will not modify `.env`, `src/integrations/supabase/client.ts`, or `src/integrations/supabase/types.ts` in this repo — those are Lovable-managed and would be regenerated. Instead I'll write the new values to a separate file you apply after you export the project from Lovable.

## What you must understand before approving

1. **`.env`, `client.ts`, `types.ts` will NOT be edited inside this Lovable project.** Lovable Cloud regenerates them. The migration only takes effect once you export the codebase to GitHub / your own host and Lovable Cloud is no longer managing it.
2. **`auth.users` cannot be migrated by SQL.** Supabase password hashes live in the `auth` schema and cannot be exported with normal SQL. Existing users will need to either reset their password on the new project or be re-invited. I'll flag the affected user IDs so you can plan around it.
3. **Storage files** (the `profile-media` bucket) are not copied by SQL — only the row references are. You'll need to either re-upload or use Supabase's storage transfer (CLI `supabase storage cp`, or a script using service role keys on both projects). I'll generate that script.
4. **Edge function secrets** (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `LOVABLE_API_KEY`) must be re-added in your new project's secrets — I cannot copy them. The new `LOVABLE_API_KEY` only exists inside Lovable Cloud and won't work outside it; you'll need to replace any AI Gateway calls with your own provider keys (OpenAI, Google AI, etc.) on the forked deployment.
5. **The Stripe webhook URL changes.** After deploying the `stripe-webhook` function on your new Supabase project, you must update the endpoint URL in your Stripe dashboard and put the new signing secret into your new project's secrets.
6. **The anon key you pasted in chat is now in chat history.** Since anon keys are public-by-design this is fine, but if you'd rather, rotate it in your Supabase API settings before going live.

## What I will produce

All artifacts written to `/mnt/documents/migration-fork/` and surfaced as downloadable `presentation-artifact` tags.

### 1. Schema dump — `01_schema.sql`
Generated from `information_schema` + `pg_catalog` queries against the current Cloud DB. Includes:
- `CREATE TYPE` for all custom enums (e.g. `app_role`)
- `CREATE TABLE` for all 47+ tables with column types, defaults, NOT NULL, primary keys, unique constraints
- All `CREATE INDEX` statements
- All foreign keys (added at end so order doesn't matter)
- All `CREATE FUNCTION` definitions (the 30+ functions shown in `db-functions`, with `SECURITY DEFINER` and `search_path` preserved)
- All triggers wired to those functions
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
- All RLS policies verbatim
- Realtime publication membership (`ALTER PUBLICATION supabase_realtime ADD TABLE …`)

### 2. Data dump — `02_data.sql`
Reuse the existing `database_data_backup.sql` you already generated, prepended with `SET session_replication_role = replica;` so triggers don't double-fire on import. I'll regenerate it fresh to make sure it matches the current state and includes any tables added since.

### 3. Storage manifest + copy script — `03_storage_copy.ts`
- A list of every object in the `profile-media` bucket (path, size, content-type, owner)
- A Deno script that, given `SOURCE_SERVICE_ROLE_KEY` and `DEST_SERVICE_ROLE_KEY` env vars, streams every file from the old bucket to the new one and recreates the bucket with the same public/private setting
- A separate `03_storage_buckets.sql` to `INSERT` the bucket row into `storage.buckets` on the destination

### 4. Edge functions bundle — `04_edge_functions/`
A copy of every function under `supabase/functions/` (`create-checkout`, `create-event-price`, `create-ticket-checkout`, `send-notification-email`, `send-showcase-welcome`, `send-ticket-email`, `stripe-webhook`, `track-profile-view`) plus a `README.md` listing:
- Required secrets per function
- Deployment command (`supabase functions deploy <name> --project-ref piofmmawwnermvaysonw`)
- Whether `verify_jwt` should be off (e.g. `stripe-webhook`)
- Note that `LOVABLE_API_KEY` calls (if any) need to be swapped for direct provider calls

### 5. Auth users export helper — `05_auth_users.csv` + `05_auth_notes.md`
- CSV with `id, email, created_at, raw_user_meta_data` for every existing user (read from `auth.users` via the read_query tool, which has access)
- Notes explaining: (a) you can use Supabase's `auth.admin.createUser` to bulk-create these without passwords, (b) trigger a password reset email to each, or (c) use Supabase's official "Migrate auth users" guide with the service role key and `pg_dump` of `auth.users` if you have direct DB access via the Supabase dashboard's connection string (which Lovable does not expose, so you'd need to ask Lovable support or skip this and do (a)+(b))

### 6. Post-fork code patch — `06_apply_after_fork.md` + `06_client.ts.patch` + `06_env.patch`
After you export the project from Lovable to your own GitHub/host, apply:
- Replace `.env` contents with:
  ```
  VITE_SUPABASE_PROJECT_ID="piofmmawwnermvaysonw"
  VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJI…Kg7xNww"
  VITE_SUPABASE_URL="https://piofmmawwnermvaysonw.supabase.co"
  ```
- `src/integrations/supabase/client.ts` — no change needed; it already reads from env vars
- `src/integrations/supabase/types.ts` — regenerate with `supabase gen types typescript --project-id piofmmawwnermvaysonw > src/integrations/supabase/types.ts` after schema is imported
- `supabase/config.toml` — change `project_id` to `piofmmawwnermvaysonw`
- Search/replace any hardcoded `gbiostpdhvfxpppfqskw` references (there are several in DB function bodies — already handled by `01_schema.sql`, but also check edge functions)

### 7. Run order — `00_README.md`
The exact sequence to run on the new project:
1. Create project at `piofmmawwnermvaysonw` (already done)
2. Run `01_schema.sql` via SQL editor or `psql`
3. Run `03_storage_buckets.sql`, then `03_storage_copy.ts`
4. Run `02_data.sql`
5. Migrate auth users per `05_auth_notes.md`
6. Add secrets to new project (list provided)
7. Deploy edge functions per `04_edge_functions/README.md`
8. Update Stripe webhook URL + signing secret
9. Export Lovable project to GitHub, apply `06_*` patches, deploy

## Out of scope

- I will not edit any file inside this Lovable project's source tree (no point — Lovable Cloud regenerates the affected files and the app needs to keep working here until you cut over).
- I will not run anything against `piofmmawwnermvaysonw`. You'll execute the SQL/scripts yourself with your own service role key.
- I cannot extract password hashes from `auth.users` — Supabase exposes them only via direct DB connection with superuser, which Lovable Cloud doesn't grant. See `05_auth_notes.md`.

## Tools I'll use after approval

- `supabase--read_query` (heavily) to dump schema, indexes, FKs, policies, triggers, function bodies, storage object lists, auth user list
- `code--exec` to run Python scripts that format the queries into clean SQL files and zip the edge functions
- `code--copy` to bundle `supabase/functions/` into the output dir

Estimated output: ~5–15 MB total depending on data and storage manifest size.