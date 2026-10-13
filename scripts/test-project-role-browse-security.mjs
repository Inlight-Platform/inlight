import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}`).split('/*')[0]
  .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, '');
const children = migration('20261006213000_inv96_group9_project_child_access.sql');
const roles = children.slice(children.indexOf('DROP POLICY IF EXISTS "Project creator can delete roles"'),
  children.indexOf('DROP POLICY IF EXISTS "Link owners or project creators can delete links"'));
const baseline = `DO $$ DECLARE p record; BEGIN
FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_roles' LOOP
EXECUTE format('DROP POLICY %I ON public.project_roles', p.policyname);
END LOOP; END $$;
${roles}
REVOKE ALL ON public.project_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_roles TO authenticated;
` + migration('20261006214500_inv96_group9_public_job_teasers.sql');
const fixed = process.argv.includes('--fix');
const fix = fixed ? migration('20261013220000_project_role_browse_invoker.sql')
  : process.argv.includes('--naive') ? 'ALTER VIEW public.project_roles_public_browse SET (security_invoker=true);' : '';
const snapshot = `CREATE TEMP TABLE expected_role_teasers AS SELECT to_jsonb(c) AS fields FROM public.project_roles_public_browse c;
CREATE TEMP TABLE expected_role_columns AS SELECT attname, atttypid, atttypmod, attnum FROM pg_attribute
WHERE attrelid = 'public.project_roles_public_browse'::regclass AND attnum > 0 AND NOT attisdropped;`;
const hosted = fixed ? read('supabase/tests/project_role_browse_hosted_readonly.sql')
  .replace(/^\s*(BEGIN READ ONLY|ROLLBACK);\s*$/gm, '') : '';
// No hosted connection option: every fixture, DDL change and mutation rolls back.
const sql = `BEGIN;\n${baseline}\n${read('supabase/tests/project_role_browse_fixtures.sql')}\n${snapshot}\n${fix}\n${read('supabase/tests/project_role_browse_assertions.sql')}\n${hosted}\n${fixed ? read('supabase/tests/project_role_browse_projection.sql') : ''}\nROLLBACK;`;
const result = spawnSync('psql', ['postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-v', 'ON_ERROR_STOP=1'],
  { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
