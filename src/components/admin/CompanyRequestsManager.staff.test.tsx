import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

type StaffRow = {
  id: string; company_id: string; email: string; staff_name: string | null; created_at: string;
  last_used_at: string | null; expires_at: string | null; revoked_at: string | null;
};
const state = vi.hoisted(() => ({
  staff: [] as StaffRow[],
  companies: [] as Array<{ id: string; name: string; description: string | null; website_url: string | null; created_at: string }>,
  select: vi.fn(),
  order: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => {
        state.select(table, columns);
        return {
          order: async (column: string, options: { ascending: boolean }) => {
            state.order(table, column, options);
            if (table === 'company_account_requests') return { data: [], error: null };
            if (table === 'companies') return { data: state.companies, error: null };
            if (table === 'company_staff_access') return { data: state.staff, error: null };
            throw new Error(`Unexpected table: ${table}`);
          },
        };
      },
    }),
  },
}));

const company = (id: string, name: string) => ({ id, name, description: null, website_url: null, created_at: '2026-01-01T00:00:00Z' });
const staff = (id: string, companyId: string, email: string, name: string | null, extra: Partial<StaffRow> = {}): StaffRow => ({
  id, company_id: companyId, email, staff_name: name, created_at: '2026-01-01T00:00:00Z',
  last_used_at: null, expires_at: null, revoked_at: null, ...extra,
});
const renderManager = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
  for (const key of [['admin-company-requests'], ['admin-tracked-companies'], ['admin-company-staff-access']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByRole('heading', { name: 'Company Alpha' });
};
const companyCard = (name: string) => {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error(`Missing company card: ${name}`);
  return card;
};

beforeEach(() => {
  state.staff = [];
  state.companies = [company('company-a', 'Company Alpha')];
  state.select.mockReset();
  state.order.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('company staff access rows', () => {
  it('groups returned rows by company and preserves their order and active counts', async () => {
    state.companies = [company('company-a', 'Company Alpha'), company('company-b', 'Company Beta')];
    state.staff = [
      staff('a1', 'company-a', 'named@example.test', 'Named Editor'),
      staff('b1', 'company-b', 'unnamed@example.test', null),
      staff('a2', 'company-a', 'revoked@example.test', 'Revoked Editor', { revoked_at: '2026-02-01T00:00:00Z' }),
      staff('b2', 'company-b', 'second@example.test', 'Second Editor'),
    ];
    await renderManager();
    const alpha = companyCard('Company Alpha');
    const beta = companyCard('Company Beta');
    expect(within(alpha).getByText('1 staff')).toBeTruthy();
    expect(within(beta).getByText('2 staff')).toBeTruthy();
    const named = within(alpha).getByText('Named Editor');
    const revoked = within(alpha).getByText('Revoked Editor');
    expect(within(alpha).getByText(/named@example\.test/)).toBeTruthy();
    expect(within(alpha).getByText(/revoked@example\.test.*revoked/)).toBeTruthy();
    expect(within(alpha).queryByText('unnamed@example.test')).toBeNull();
    const unnamed = within(beta).getByText('unnamed@example.test');
    const second = within(beta).getByText('Second Editor');
    expect(named.compareDocumentPosition(revoked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unnamed.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(state.select).toHaveBeenCalledWith('company_staff_access', 'id, company_id, email, staff_name, created_at, last_used_at, expires_at, revoked_at');
    expect(state.order).toHaveBeenCalledWith('company_staff_access', 'created_at', { ascending: false });
  });

  it('renders the email fallback without used or revoked text for nullable fields', async () => {
    state.staff = [staff('a1', 'company-a', 'fallback@example.test', null)];
    await renderManager();
    const card = companyCard('Company Alpha');
    expect(within(card).getByText('fallback@example.test')).toBeTruthy();
    expect(within(card).getByText('1 staff')).toBeTruthy();
    expect(within(card).getByText(/Added /)).toBeTruthy();
    expect(within(card).queryByText(/ · used /)).toBeNull();
    expect(within(card).queryByText(/ · revoked/)).toBeNull();
  });

  it('shows zero staff and the existing empty message after the queries settle', async () => {
    await renderManager();
    const card = companyCard('Company Alpha');
    expect(within(card).getByText('0 staff')).toBeTruthy();
    expect(within(card).getByText('No staff emails have been added for this page.')).toBeTruthy();
  });
});
