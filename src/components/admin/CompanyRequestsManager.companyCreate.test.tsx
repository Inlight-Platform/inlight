import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

const state = vi.hoisted(() => ({
  mode: 'invite' as 'invite' | 'empty' | 'error',
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
          if (table === 'company_account_requests' || table === 'companies' || table === 'company_staff_access') return { data: [], error: null };
          throw new Error(`Unexpected table: ${table}`);
        },
      }),
    }),
  },
}));

beforeEach(() => {
  state.mode = 'invite';
  state.rpc.mockReset();
  state.success.mockReset();
  state.error.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name !== 'admin_create_company_page') throw new Error(`Unexpected RPC: ${name}`);
    if (state.mode === 'error') return { data: null, error: new Error('Synthetic creation failure') };
    const invites = state.mode === 'invite'
      ? [{ id: 'access-1', company_id: 'company-1', email: 'staff@example.test', staff_name: 'Synthetic Staff', token: 'synthetic-token' }]
      : [];
    return { data: { company_id: 'company-1', invites }, error: null };
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
  const heading = await screen.findByRole('heading', { name: 'Create company page' });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error('Missing company creation card');
  fireEvent.click(within(card).getByRole('button', { name: 'New company page' }));
  invalidate.mockClear();
  return { card, invalidate };
};
const fillCompany = (card: HTMLElement) => {
  fireEvent.change(within(card).getByLabelText('Company name'), { target: { value: '  Synthetic Company  ' } });
  fireEvent.change(within(card).getByLabelText('Website'), { target: { value: '  https://example.test  ' } });
  fireEvent.change(within(card).getByLabelText('Short description'), { target: { value: '  Synthetic description  ' } });
};
const fillStaff = (card: HTMLElement) => {
  fireEvent.change(within(card).getByPlaceholderText('Staff name'), { target: { value: '  Synthetic Staff  ' } });
  fireEvent.change(within(card).getByPlaceholderText('staff@company.com'), { target: { value: '  Staff@Example.Test  ' } });
};
const expectedArgs = {
  _name: 'Synthetic Company', _description: 'Synthetic description', _website_url: 'https://example.test',
  _staff_members: [{ name: 'Synthetic Staff', email: 'staff@example.test' }],
};
const expectReset = (card: HTMLElement) => {
  expect(within(card).getByLabelText('Company name')).toHaveValue('');
  expect(within(card).getByLabelText('Website')).toHaveValue('');
  expect(within(card).getByLabelText('Short description')).toHaveValue('');
  expect(within(card).getByPlaceholderText('Staff name')).toHaveValue('');
  expect(within(card).getByPlaceholderText('staff@company.com')).toHaveValue('');
};

describe('admin company creation', () => {
  it('creates a company with a staff invite and resets the form', async () => {
    const { card, invalidate } = await renderManager();
    fillCompany(card);
    fillStaff(card);
    fireEvent.click(within(card).getByRole('button', { name: 'Create page' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Company page created'));
    expect(state.rpc).toHaveBeenCalledWith('admin_create_company_page', expectedArgs);
    expect(invalidate).toHaveBeenCalledTimes(4);
    for (const queryKey of [['companies'], ['admin-tracked-companies'], ['admin-company-staff-access'], ['admin-company-requests']]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    await waitFor(() => expect(within(card).getByLabelText('Company name')).toHaveValue(''));
    expectReset(card);
    expect(within(card).getByRole('link', { name: /Open admin page/ })).toHaveAttribute('href', '/company/company-1');
    expect(within(card).getByText('Synthetic Staff')).toBeTruthy();
    expect(within(card).getByText(`${window.location.origin}/company-edit/synthetic-token`)).toBeTruthy();
  });

  it('creates a company with no invites and shows no staff-link section', async () => {
    state.mode = 'empty';
    const { card } = await renderManager();
    fillCompany(card);
    fireEvent.click(within(card).getByRole('button', { name: 'Create page' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Company page created'));
    expect(state.rpc).toHaveBeenCalledWith('admin_create_company_page', { ...expectedArgs, _staff_members: [] });
    await waitFor(() => expect(within(card).getByRole('link', { name: /Open admin page/ })).toHaveAttribute('href', '/company/company-1'));
    expectReset(card);
    expect(within(card).queryByText('Staff edit links')).toBeNull();
  });

  it('retains the form and skips success invalidations on RPC error', async () => {
    state.mode = 'error';
    const { card, invalidate } = await renderManager();
    fillCompany(card);
    fillStaff(card);
    fireEvent.click(within(card).getByRole('button', { name: 'Create page' }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic creation failure'));
    expect(state.rpc).toHaveBeenCalledWith('admin_create_company_page', expectedArgs);
    expect(state.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(within(card).getByLabelText('Company name')).toHaveValue('  Synthetic Company  ');
    expect(within(card).getByLabelText('Website')).toHaveValue('  https://example.test  ');
    expect(within(card).getByLabelText('Short description')).toHaveValue('  Synthetic description  ');
    expect(within(card).getByPlaceholderText('Staff name')).toHaveValue('  Synthetic Staff  ');
    expect(within(card).getByPlaceholderText('staff@company.com')).toHaveValue('  Staff@Example.Test  ');
  });
});
