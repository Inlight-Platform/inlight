import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';

it('includes the invite token and return path in the existing-account email', async () => {
  const source = readFileSync(resolve('supabase/functions/send-group-admin-invite/index.ts'), 'utf8')
    .replace(/^import .*;\n/gm, '');
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler: (request: Request) => Promise<Response>;
  const deno = {
    env: { get: (key: string) => ({ SITE_URL: 'http://127.0.0.1:18081', SUPABASE_URL: 'http://127.0.0.1:54321' } as Record<string, string>)[key] },
    serve: (callback: typeof handler) => { handler = callback; },
  };
  const createClient = () => ({ rpc: async () => ({ data: {
    email: 'person@example.com', existing_user: false, account_exists: true,
    token: 'token +/=', group_name: 'Invited', group_slug: 'invited',
  }, error: null }) });
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  new Function('Deno', 'createClient', 'Resend', 'fetch', javascript)(deno, createClient, undefined, fetchMock);

  const response = await handler!(new Request('http://localhost', {
    method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId: 'group', email: 'person@example.com' }),
  }));
  const result = await response.json();
  const url = new URL(result.inviteUrl);
  expect(url.searchParams.get('invite')).toBe('token +/=');
  expect(url.searchParams.get('returnTo')).toBe('/groups/invited');
  expect(url.searchParams.has('mode')).toBe(false);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).Text).toContain(result.inviteUrl);
});
