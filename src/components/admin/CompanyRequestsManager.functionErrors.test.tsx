import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

const state = vi.hoisted(() => ({ invoke: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: state.success, warning: state.warning, error: state.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: state.invoke },
    rpc: async (name: string) => {
      if (name !== 'get_company_requester_profiles') throw new Error(`Unexpected RPC: ${name}`);
      return { data: [{ user_id: 'user-1', display_name: 'Synthetic Requester', email: 'requester@example.test', avatar_url: null }], error: null };
    },
    from: (table: string) => ({
      select: () => ({
        order: async () => {
          if (table === 'company_account_requests') return { data: [{ id: 'request-1', requester_id: 'user-1', company_name: 'Synthetic Company', description: null, website_url: null, justification: 'Synthetic reason', status: 'pending', admin_notes: null, created_company_id: null, created_at: '2026-01-01T00:00:00Z', reviewed_at: null }], error: null };
          if (table === 'companies' || table === 'company_staff_access') return { data: [], error: null };
          throw new Error(`Unexpected table: ${table}`);
        },
      }),
    }),
  },
}));

beforeEach(() => {
  state.invoke.mockReset();
  state.success.mockReset();
  state.warning.mockReset();
  state.error.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const showError = async (failure: unknown, message: string) => {
  state.invoke.mockResolvedValue({ data: null, error: failure });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
  for (const key of [['admin-company-requests'], ['admin-tracked-companies'], ['admin-company-staff-access']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  const heading = await screen.findByRole('heading', { name: 'Synthetic Company' });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error('Missing request card');
  invalidate.mockClear();
  fireEvent.click(within(card).getByRole('button', { name: 'Approve' }));
  const dialog = await screen.findByRole('dialog', { name: 'Approve request for Synthetic Company' });
  fireEvent.change(within(dialog).getByPlaceholderText('Notes (optional)'), { target: { value: 'Synthetic notes' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Approve' }));
  await waitFor(() => expect(state.error).toHaveBeenCalledWith(message));
  expect(state.invoke).toHaveBeenCalledWith('approve-company-account', { body: { request_id: 'request-1', admin_notes: 'Synthetic notes' } });
  expect(state.success).not.toHaveBeenCalled();
  expect(state.warning).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Approve request for Synthetic Company' })).toBeTruthy();
  expect(within(dialog).getByPlaceholderText('Notes (optional)')).toHaveValue('Synthetic notes');
  invalidate.mockRestore();
};
const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { status: 400, headers: { 'Content-Type': 'application/json' } });
const fallback = 'Failed to approve company account';

describe('company function invocation errors', () => {
  it('combines HTTP JSON error and detail strings', async () => {
    await showError(new FunctionsHttpError(jsonResponse({ error: 'Request failed', details: { message: 'Specific detail', error: 'Other detail' } })), 'Request failed: Specific detail');
  });

  it('uses an HTTP JSON error string', async () => {
    await showError(new FunctionsHttpError(jsonResponse({ error: 'Synthetic HTTP error' })), 'Synthetic HTTP error');
  });

  it('uses the caller fallback when HTTP JSON has no usable fields', async () => {
    await showError(new FunctionsHttpError(jsonResponse({})), fallback);
  });

  it('uses the second clone for non-JSON HTTP text', async () => {
    await showError(new FunctionsHttpError(new Response('Synthetic response text', { status: 400 })), 'Synthetic response text');
  });

  it('uses the HTTP class message when both clone attempts fail', async () => {
    const response = new Response('unreadable', { status: 400 });
    const clone = vi.spyOn(response, 'clone').mockImplementation(() => { throw new Error('Cannot clone'); });
    await showError(new FunctionsHttpError(response), 'Edge Function returned a non-2xx status code');
    expect(clone).toHaveBeenCalledTimes(2);
  });

  it('parses a relay error with a JSON Response', async () => {
    await showError(new FunctionsRelayError(jsonResponse({ message: 'Synthetic relay detail' })), 'Synthetic relay detail');
  });

  it('uses the fetch error message without parsing its context', async () => {
    await showError(new FunctionsFetchError(new Error('Synthetic network cause')), 'Failed to send a request to the Edge Function');
  });

  it('uses a plain local Error message', async () => {
    await showError(new Error('Synthetic plain error'), 'Synthetic plain error');
  });

  it('uses the caller fallback for a plain object with a message', async () => {
    await showError({ message: 'Synthetic object message' }, fallback);
  });

  it('does not parse a plain object custom response-like context', async () => {
    const clone = vi.fn();
    const json = vi.fn();
    await showError({ context: { clone, json }, message: 'Synthetic object message' }, fallback);
    expect(clone).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('ignores non-string HTTP JSON fields and uses the next string', async () => {
    await showError(new FunctionsHttpError(jsonResponse({ error: 42, details: { message: 17 }, message: 'Usable message' })), 'Usable message');
  });

  it('falls back for non-string and throwing Error messages in independent mounts', async () => {
    const nonString = new Error('original');
    Object.defineProperty(nonString, 'message', { configurable: true, value: 42 });
    await showError(nonString, fallback);
    cleanup();
    state.error.mockClear();
    state.invoke.mockClear();
    const throwing = new Error('original');
    Object.defineProperty(throwing, 'message', { configurable: true, get: () => { throw new Error('Message getter failed'); } });
    await showError(throwing, fallback);
  });

  it('uses the caller fallback when a recognized error context read throws', async () => {
    const failure = new FunctionsHttpError(jsonResponse({ error: 'unused' }));
    Object.defineProperty(failure, 'context', { configurable: true, get: () => { throw new Error('Context getter failed'); } });
    await showError(failure, fallback);
  });
});
