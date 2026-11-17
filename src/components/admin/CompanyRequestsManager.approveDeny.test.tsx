import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

const state = vi.hoisted(() => ({
  data: null as unknown,
  invokeError: null as Error | null,
  invoke: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

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
  state.data = null;
  state.invokeError = null;
  state.invoke.mockReset();
  state.success.mockReset();
  state.warning.mockReset();
  state.error.mockReset();
  state.invoke.mockImplementation(async () => ({ data: state.data, error: state.invokeError }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

type Action = 'Approve' | 'Deny';
const renderManager = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
  for (const key of [['admin-company-requests'], ['admin-tracked-companies'], ['admin-company-staff-access']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByRole('heading', { name: 'Synthetic Company' });
  invalidate.mockClear();
  return invalidate;
};
const openDialog = async (action: Action) => {
  const heading = screen.getByRole('heading', { name: 'Synthetic Company' });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error('Missing request card');
  fireEvent.click(within(card).getByRole('button', { name: action }));
  return screen.findByRole('dialog', { name: `${action} request for Synthetic Company` });
};
const submit = async (action: Action) => {
  const dialog = await openDialog(action);
  fireEvent.change(within(dialog).getByPlaceholderText('Notes (optional)'), { target: { value: 'Synthetic notes' } });
  fireEvent.click(within(dialog).getByRole('button', { name: `Confirm ${action}` }));
  return dialog;
};
const assertCall = (action: Action) => {
  expect(state.invoke).toHaveBeenCalledWith(`${action.toLowerCase()}-company-account`, {
    body: { request_id: 'request-1', admin_notes: 'Synthetic notes' },
  });
};
const assertSuccess = async (action: Action, message: string, invalidate: ReturnType<typeof vi.spyOn>, warning = false) => {
  await waitFor(() => expect(warning ? state.warning : state.success).toHaveBeenCalledWith(message));
  assertCall(action);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin-company-requests'] });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: `${action} request for Synthetic Company` })).toBeNull());
  const reopened = await openDialog(action);
  expect(within(reopened).getByPlaceholderText('Notes (optional)')).toHaveValue('');
};
const assertFailure = async (action: Action, message: string, dialog: HTMLElement, invalidate: ReturnType<typeof vi.spyOn>) => {
  await waitFor(() => expect(state.error).toHaveBeenCalledWith(message));
  assertCall(action);
  expect(state.success).not.toHaveBeenCalled();
  expect(state.warning).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: `${action} request for Synthetic Company` })).toBeTruthy();
  expect(within(dialog).getByPlaceholderText('Notes (optional)')).toHaveValue('Synthetic notes');
};
const missingResponses = async (action: Action, message: string) => {
  for (const data of [null, {}]) {
    state.data = data;
    state.invoke.mockClear();
    state.success.mockClear();
    state.warning.mockClear();
    state.error.mockClear();
    const invalidate = await renderManager();
    await submit(action);
    await assertSuccess(action, message, invalidate);
    cleanup();
    invalidate.mockRestore();
  }
};

describe('company request approval and denial', () => {
  it('approves when the email is sent', async () => {
    state.data = { approval_email_sent: true };
    const invalidate = await renderManager();
    await submit('Approve');
    await assertSuccess('Approve', 'Company account created and approval email sent', invalidate);
  });

  it('approves with a warning when the email is not sent', async () => {
    state.data = { approval_email_sent: false };
    const invalidate = await renderManager();
    await submit('Approve');
    await assertSuccess('Approve', 'Company account created, but the approval email was not sent', invalidate, true);
  });

  it('retains approval state for an error payload', async () => {
    state.data = { error: 'Synthetic approval payload error' };
    const invalidate = await renderManager();
    const dialog = await submit('Approve');
    await assertFailure('Approve', 'Synthetic approval payload error', dialog, invalidate);
  });

  it('retains approval state for an invoke error', async () => {
    state.invokeError = new Error('Synthetic approval invoke error');
    const invalidate = await renderManager();
    const dialog = await submit('Approve');
    await assertFailure('Approve', 'Synthetic approval invoke error', dialog, invalidate);
  });

  it('uses the approval success fallback for null and empty data', async () => {
    await missingResponses('Approve', 'Company account created and approval email sent');
  });

  it('denies when the email is sent', async () => {
    state.data = { denial_email_sent: true };
    const invalidate = await renderManager();
    await submit('Deny');
    await assertSuccess('Deny', 'Request denied and email sent', invalidate);
  });

  it('denies with a warning when the email is not sent', async () => {
    state.data = { denial_email_sent: false };
    const invalidate = await renderManager();
    await submit('Deny');
    await assertSuccess('Deny', 'Request denied, but the denial email was not sent', invalidate, true);
  });

  it('retains denial state for an error payload', async () => {
    state.data = { error: 'Synthetic denial payload error' };
    const invalidate = await renderManager();
    const dialog = await submit('Deny');
    await assertFailure('Deny', 'Synthetic denial payload error', dialog, invalidate);
  });

  it('retains denial state for an invoke error', async () => {
    state.invokeError = new Error('Synthetic denial invoke error');
    const invalidate = await renderManager();
    const dialog = await submit('Deny');
    await assertFailure('Deny', 'Synthetic denial invoke error', dialog, invalidate);
  });

  it('uses the denial success fallback for null and empty data', async () => {
    await missingResponses('Deny', 'Request denied and email sent');
  });
});
