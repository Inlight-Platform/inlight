import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

const state = vi.hoisted(() => ({
  staff: new Array<Record<string, unknown>>(), rpc: vi.fn(), invoke: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc, functions: { invoke: state.invoke },
    from: (table: string) => ({ select: () => ({ order: async () => {
      if (table === 'company_account_requests') return { data: [], error: null };
      if (table === 'companies') return { data: [{ id: 'company-1', name: 'Synthetic Company', description: null, website_url: null, created_at: '2026-01-01T00:00:00Z' }], error: null };
      if (table === 'company_staff_access') return { data: state.staff, error: null };
      throw new Error('Unexpected table: ' + table);
    } }) }),
  },
}));
beforeEach(() => {
  state.staff = []; state.rpc.mockReset(); state.invoke.mockReset(); state.success.mockReset(); state.error.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name !== 'add_company_staff_access') throw new Error('Unexpected RPC: ' + name);
    state.staff = [{ id: 'access-1', company_id: 'company-1', email: 'staff@example.test', staff_name: 'Synthetic Staff', created_at: '2026-01-01T00:00:00Z', last_used_at: null, expires_at: null, revoked_at: null }];
    return { data: [{ access_id: 'access-1', access_company_id: 'company-1', access_email: 'staff@example.test', access_staff_name: 'Synthetic Staff', token: 'synthetic-token' }], error: null };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const prepareEmail = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
  for (const key of [['admin-company-requests'], ['admin-tracked-companies'], ['admin-company-staff-access']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  const heading = await screen.findByRole('heading', { name: 'Synthetic Company' });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error('Missing company card');
  fireEvent.change(within(card).getByPlaceholderText('Staff name'), { target: { value: 'Synthetic Staff' } });
  fireEvent.change(within(card).getByPlaceholderText('staff@company.com'), { target: { value: 'staff@example.test' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Add staff link' }));
  await waitFor(() => expect(state.success).toHaveBeenCalledWith('Staff edit link generated'));
  const staff = await within(card).findByText('Synthetic Staff');
  const row = staff.closest('div.rounded-md');
  if (!(row instanceof HTMLElement)) throw new Error('Missing staff row');
  const email = await within(row).findByRole('button', { name: 'Email' });
  state.success.mockClear(); state.error.mockClear();
  fireEvent.click(email);
};
const expectedBody = () => ({ body: { email: 'staff@example.test', staffName: 'Synthetic Staff', companyName: 'Synthetic Company', editUrl: window.location.origin + '/company-edit/synthetic-token' } });
describe('staff edit-link email', () => {
  it('sends the exact synthetic link payload and reports success', async () => {
    state.invoke.mockResolvedValue({ data: { message: 'Email sent' }, error: null });
    await prepareEmail();
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Staff edit link emailed'));
    expect(state.invoke).toHaveBeenCalledWith('send-company-staff-link', expectedBody());
  });
  it('reports a truthy error in a successful response', async () => {
    state.invoke.mockResolvedValue({ data: { error: 'Synthetic payload failure' }, error: null });
    await prepareEmail();
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic payload failure'));
    expect(state.invoke).toHaveBeenCalledWith('send-company-staff-link', expectedBody());
    expect(state.success).not.toHaveBeenCalledWith('Staff edit link emailed');
  });
  it('reports the helper-derived invoke error', async () => {
    state.invoke.mockResolvedValue({ data: null, error: new Error('Synthetic invoke failure') });
    await prepareEmail();
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic invoke failure'));
    expect(state.invoke).toHaveBeenCalledWith('send-company-staff-link', expectedBody());
    expect(state.success).not.toHaveBeenCalledWith('Staff edit link emailed');
  });
});
