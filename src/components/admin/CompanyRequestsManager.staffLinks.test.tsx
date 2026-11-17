import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

type StaffRow = {
  id: string; company_id: string; email: string; staff_name: string | null; created_at: string;
  last_used_at: string | null; expires_at: string | null; revoked_at: string | null;
};
const state = vi.hoisted(() => ({
  mode: 'success' as 'success' | 'empty' | 'error',
  staff: [] as StaffRow[],
  rpc: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => ({
      select: () => ({
        order: async () => {
          if (table === 'company_account_requests') return { data: [], error: null };
          if (table === 'companies') return { data: [{ id: 'company-1', name: 'Synthetic Company', description: null, website_url: null, created_at: '2026-01-01T00:00:00Z' }], error: null };
          if (table === 'company_staff_access') return { data: state.staff, error: null };
          throw new Error(`Unexpected table: ${table}`);
        },
      }),
    }),
  },
}));

beforeEach(() => {
  state.mode = 'success';
  state.staff = [];
  state.rpc.mockReset();
  state.success.mockReset();
  state.error.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name !== 'add_company_staff_access') throw new Error(`Unexpected RPC: ${name}`);
    if (state.mode === 'error') return { data: null, error: new Error('Synthetic staff failure') };
    if (state.mode === 'empty') return { data: [], error: null };
    state.staff = [{ id: 'access-1', company_id: 'company-1', email: 'staff@example.test', staff_name: 'Synthetic Staff', created_at: '2026-01-01T00:00:00Z', last_used_at: null, expires_at: null, revoked_at: null }];
    return { data: [{ access_id: 'access-1', access_company_id: 'company-1', access_email: 'staff@example.test', access_staff_name: 'Synthetic Staff', token: 'synthetic-token' }], error: null };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderManager = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
  for (const key of [['admin-company-requests'], ['admin-tracked-companies'], ['admin-company-staff-access']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  const heading = await screen.findByRole('heading', { name: 'Synthetic Company' });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error('Missing company card');
  invalidate.mockClear();
  return { card, invalidate };
};
const submitForm = (card: HTMLElement) => {
  fireEvent.change(within(card).getByPlaceholderText('Staff name'), { target: { value: '  Synthetic Staff  ' } });
  fireEvent.change(within(card).getByPlaceholderText('staff@company.com'), { target: { value: '  Staff@Example.Test  ' } });
  fireEvent.click(within(card).getByRole('button', { name: 'Add staff link' }));
};
const expectedArgs = { _company_id: 'company-1', _email: 'staff@example.test', _staff_name: 'Synthetic Staff', _expires_at: null };
const expectRetainedForm = (card: HTMLElement) => {
  expect(within(card).getByPlaceholderText('Staff name')).toHaveValue('  Synthetic Staff  ');
  expect(within(card).getByPlaceholderText('staff@company.com')).toHaveValue('  Staff@Example.Test  ');
};

describe('company staff-link form', () => {
  it('generates a link and renders it in the refetched matching staff row', async () => {
    const { card, invalidate } = await renderManager();
    submitForm(card);
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Staff edit link generated'));
    expect(state.rpc).toHaveBeenCalledWith('add_company_staff_access', expectedArgs);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin-company-staff-access'] });
    expect(within(card).getByPlaceholderText('Staff name')).toHaveValue('');
    expect(within(card).getByPlaceholderText('staff@company.com')).toHaveValue('');
    const staffName = await within(card).findByText('Synthetic Staff');
    const row = staffName.closest('div.rounded-md');
    if (!(row instanceof HTMLElement)) throw new Error('Missing staff row');
    expect(within(row).getByText(`${window.location.origin}/company-edit/synthetic-token`)).toBeTruthy();
  });

  it('shows the existing no-token error for an empty rowset', async () => {
    state.mode = 'empty';
    const { card, invalidate } = await renderManager();
    submitForm(card);
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('No edit token returned'));
    expect(state.rpc).toHaveBeenCalledWith('add_company_staff_access', expectedArgs);
    expect(state.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expectRetainedForm(card);
  });

  it('shows the returned RPC error and retains the form', async () => {
    state.mode = 'error';
    const { card, invalidate } = await renderManager();
    submitForm(card);
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic staff failure'));
    expect(state.rpc).toHaveBeenCalledWith('add_company_staff_access', expectedArgs);
    expect(state.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expectRetainedForm(card);
  });
});
