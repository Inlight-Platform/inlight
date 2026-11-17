import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, skipToken } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyProfilePage from '../CompanyProfilePage';

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  rows: [{ company_id: 'company-1', email: 'staff@example.test', staff_name: null }] as Array<{ company_id: string; email: string; staff_name: string | null }>,
  validationError: null as Error | null,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false, isLoading: false }) }));
vi.mock('@/hooks/useCompanyFollows', () => ({
  useCompanyFollows: () => ({ isFollowingCompany: () => false, followCompany: { mutate: vi.fn() }, unfollowCompany: { mutate: vi.fn() } }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc, from: state.from } }));

beforeEach(() => {
  state.rows = [{ company_id: 'company-1', email: 'staff@example.test', staff_name: null }];
  state.validationError = null;
  state.rpc.mockReset();
  state.from.mockReset();
  state.rpc.mockImplementation((name: string) => {
    if (name === 'validate_company_staff_access') return Promise.resolve({ data: state.validationError ? null : state.rows, error: state.validationError });
    if (name === 'get_company_management_context') return { maybeSingle: async () => ({ data: { owner_user_id: null }, error: null }) };
    if (name === 'get_company_staff_access_managed' || name === 'get_company_projects_browse' || name === 'get_company_photos_browse') return Promise.resolve({ data: [], error: null });
    throw new Error(`Unexpected RPC: ${name}`);
  });
  state.from.mockImplementation((table: string) => {
    const result = () => {
      if (table === 'company_follows') return { data: null, count: 0, error: null };
      if (table === 'companies_browse') return {
        data: { id: 'company-1', name: 'Synthetic Company', description: null, logo_url: null, website_url: null, location: null, fun_facts: null, is_owner: false },
        error: null,
      };
      throw new Error(`Unexpected table: ${table}`);
    };
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderPage = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><Routes>
    <Route path="/company-edit/:token" element={<CompanyProfilePage />} />
    <Route path="/company/:companyId" element={<CompanyProfilePage />} />
  </Routes></QueryClientProvider></MemoryRouter>);
  return client;
};
const waitForPublicQueries = async (client: QueryClient) => {
  for (const key of [['company', 'company-1'], ['company-follower-count', 'company-1'], ['company-projects', 'company-1'], ['company-photos', 'company-1']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByRole('heading', { name: 'Synthetic Company' });
};
const expectNoAccessFetches = () => {
  expect(state.from).not.toHaveBeenCalledWith('companies_browse');
  expect(state.rpc).not.toHaveBeenCalledWith('get_company_management_context', expect.anything());
  expect(state.rpc).not.toHaveBeenCalledWith('get_company_staff_access_managed', expect.anything());
  expect(state.rpc).not.toHaveBeenCalledWith('get_company_projects_browse', expect.anything());
  expect(state.rpc).not.toHaveBeenCalledWith('get_company_photos_browse', expect.anything());
};

describe('company staff-token validation', () => {
  it('resolves a valid token and enables the existing management queries and controls', async () => {
    const client = renderPage('/company-edit/synthetic-token');
    await waitForPublicQueries(client);
    for (const key of [['company-staff-access', 'synthetic-token'], ['company-management', 'company-1'], ['company-invited-staff', 'company-1', 'synthetic-token']]) {
      await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
    }
    expect(state.rpc).toHaveBeenCalledWith('validate_company_staff_access', { _token: 'synthetic-token' });
    expect(state.rpc).toHaveBeenCalledWith('get_company_management_context', { _company_id: 'company-1', _staff_token: 'synthetic-token' });
    expect(state.rpc).toHaveBeenCalledWith('get_company_staff_access_managed', { _company_id: 'company-1', _staff_token: 'synthetic-token' });
    expect(screen.getByRole('button', { name: 'Customize Page' })).toBeTruthy();
  });

  it('shows the invalid-link message for an empty validation result', async () => {
    state.rows = [];
    const client = renderPage('/company-edit/synthetic-token');
    await waitFor(() => expect(client.getQueryState(['company-staff-access', 'synthetic-token'])?.status).toBe('error'));
    expect(await screen.findByText('This company edit link is invalid or expired.')).toBeTruthy();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(state.rpc).toHaveBeenCalledWith('validate_company_staff_access', { _token: 'synthetic-token' });
    expectNoAccessFetches();
  });

  it('shows the invalid-link message after a validation RPC error', async () => {
    state.validationError = new Error('Synthetic validation failure');
    const client = renderPage('/company-edit/synthetic-token');
    await waitFor(() => expect(client.getQueryState(['company-staff-access', 'synthetic-token'])?.status).toBe('error'));
    expect(await screen.findByText('This company edit link is invalid or expired.')).toBeTruthy();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(state.rpc).toHaveBeenCalledWith('validate_company_staff_access', { _token: 'synthetic-token' });
    expectNoAccessFetches();
  });

  it('keeps validation and management disabled on the public route without a token', async () => {
    const client = renderPage('/company/company-1');
    await waitForPublicQueries(client);
    await waitFor(() => expect(client.getQueryState(['company-staff-access', undefined])?.fetchStatus).toBe('idle'));
    expect(state.rpc).not.toHaveBeenCalledWith('validate_company_staff_access', expect.anything());
    expect(state.rpc).not.toHaveBeenCalledWith('get_company_management_context', expect.anything());
    expect(state.rpc).not.toHaveBeenCalledWith('get_company_staff_access_managed', expect.anything());
    expect(state.rpc).toHaveBeenCalledWith('get_company_projects_browse', { _company_id: 'company-1' });
    expect(state.rpc).toHaveBeenCalledWith('get_company_photos_browse', { _company_id: 'company-1' });
    expect(screen.queryByRole('button', { name: 'Customize Page' })).toBeNull();
  });

  it('rejects an imperative fetch of the registered disabled validation query', async () => {
    const client = renderPage('/company/company-1');
    await waitForPublicQueries(client);
    const query = client.getQueryCache().find({ queryKey: ['company-staff-access', undefined], exact: true });
    expect(query).toBeDefined();
    if (!query) throw new Error('Missing registered staff-access query');
    expect(query.options.queryFn).toBe(skipToken);
    expect(query.state.fetchStatus).toBe('idle');
    await act(async () => {
      await expect(query.fetch()).rejects.toThrow(`Missing queryFn: '${query.queryHash}'`);
    });
    expect(state.rpc).not.toHaveBeenCalledWith('validate_company_staff_access', expect.anything());
  });
});
