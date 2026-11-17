import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyRequestsManager from './CompanyRequestsManager';

type RequestFixture = {
  id: string; requester_id: string; company_name: string; description: string | null;
  website_url: string | null; justification: string; status: string; admin_notes: string | null;
  created_company_id: string | null; created_at: string; reviewed_at: string | null;
};
const state = vi.hoisted(() => ({
  requests: [] as RequestFixture[],
  profiles: [] as Array<{ user_id: string; display_name: string | null; email: string; avatar_url: string | null }>,
  profileError: null as Error | null,
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => ({
      select: () => ({
        order: async () => {
          if (table === 'company_account_requests') return { data: state.requests, error: null };
          if (table === 'companies' || table === 'company_staff_access') return { data: [], error: null };
          throw new Error(`Unexpected table: ${table}`);
        },
      }),
    }),
  },
}));

const request = (id: string, requester: string, company: string): RequestFixture => ({
  id, requester_id: requester, company_name: company, description: null, website_url: null,
  justification: 'Synthetic reason', status: 'pending', admin_notes: null, created_company_id: null,
  created_at: '2026-01-01T00:00:00Z', reviewed_at: null,
});
const renderManager = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
  for (const key of [['admin-company-requests'], ['admin-tracked-companies'], ['admin-company-staff-access']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByRole('heading', { name: 'Company requests' });
};
const requestCard = (name: string) => {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('div.rounded-xl');
  if (!(card instanceof HTMLElement)) throw new Error(`Missing request card: ${name}`);
  return card;
};

beforeEach(() => {
  state.requests = [];
  state.profiles = [];
  state.profileError = null;
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name !== 'get_company_requester_profiles') throw new Error(`Unexpected RPC: ${name}`);
    return { data: state.profileError ? null : state.profiles, error: state.profileError };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('company requester rows', () => {
  it('deduplicates requester IDs and matches profiles to each request', async () => {
    state.requests = [
      request('request-1', 'user-a', 'Company Alpha'),
      request('request-2', 'user-b', 'Company Beta'),
      request('request-3', 'user-a', 'Company Gamma'),
      request('request-4', 'user-missing', 'Company Delta'),
    ];
    state.profiles = [
      { user_id: 'user-b', display_name: null, email: 'beta@example.test', avatar_url: null },
      { user_id: 'user-a', display_name: 'Synthetic Alice', email: 'alice@example.test', avatar_url: null },
    ];
    await renderManager();
    await screen.findByRole('heading', { name: 'Company Alpha' });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith('get_company_requester_profiles', { _user_ids: ['user-a', 'user-b', 'user-missing'] });
    expect(within(requestCard('Company Alpha')).getByText('Synthetic Alice')).toBeTruthy();
    expect(within(requestCard('Company Beta')).getByText('beta@example.test')).toBeTruthy();
    expect(within(requestCard('Company Gamma')).getByText('Synthetic Alice')).toBeTruthy();
    expect(within(requestCard('Company Delta')).getByText('Unknown')).toBeTruthy();
  });

  it('does not fetch requester profiles for an empty request list', async () => {
    await renderManager();
    expect(await screen.findByText('No matching company requests.')).toBeTruthy();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('retains the empty-request rendering after a requester-profile RPC error', async () => {
    state.requests = [request('request-1', 'user-a', 'Company Alpha')];
    state.profileError = new Error('Synthetic profile failure');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CompanyRequestsManager /></QueryClientProvider>);
    await waitFor(() => expect(client.getQueryState(['admin-company-requests'])?.status).toBe('error'));
    for (const key of [['admin-tracked-companies'], ['admin-company-staff-access']]) {
      await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
    }
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(await screen.findByText('No matching company requests.')).toBeTruthy();
    expect(state.rpc).toHaveBeenCalledWith('get_company_requester_profiles', { _user_ids: ['user-a'] });
  });
});
