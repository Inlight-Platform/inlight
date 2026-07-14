import { rest } from 'msw';

// Handlers for MSW to mock Supabase function endpoints and to fail on unexpected calls.
export const handlers = [
  // Mock invocation of Supabase function send-password-reset
  rest.post('https://:host/functions/v1/send-password-reset', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: { ok: true } }));
  }),

  // Mock invocation of Supabase function send-showcase-welcome
  rest.post('https://:host/functions/v1/send-showcase-welcome', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: { ok: true } }));
  }),

  // Generic catch-all for Supabase host to prevent accidental production calls
  rest.all('https://:host/*', (req, res, ctx) => {
    // Fail tests on unexpected network calls in order to enforce deterministic mocks
    return res(
      ctx.status(500),
      ctx.json({ error: 'Unexpected network call in test. Use MSW handlers or vi.mock for supabase client.' })
    );
  }),
];
