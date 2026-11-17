import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyProfilePage from '../CompanyProfilePage';

const state = vi.hoisted(() => ({
  isOwner: true,
  staff: [] as Array<{ email: string; staff_name: string | null }>,
  rpc: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' }, loading: false }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false, isLoading: false }) }));
vi.mock('@/hooks/useCompanyFollows', () => ({
  useCompanyFollows: () => ({
    isFollowingCompany: () => false,
    followCompany: { mutate: vi.fn() },
    unfollowCompany: { mutate: vi.fn() },
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
      const result = () => {
        if (table === 'company_follows') return { data: null, count: 0, error: null };
        if (table === 'companies_browse') return {
          data: { id: 'company-1', name: 'Synthetic Company', description: null, logo_url: null, website_url: null, location: null, fun_facts: null, is_owner: state.isOwner },
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
    },
  },
}));

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={['/company/company-1']}>
      <QueryClientProvider client={client}>
        <Routes><Route path="/company/:companyId" element={<CompanyProfilePage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return client;
};

const waitForQuery = async (client: QueryClient, key: readonly unknown[]) => {
  await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
};

beforeEach(() => {
  state.isOwner = true;
  state.staff = [];
  state.rpc.mockReset();
  state.rpc.mockImplementation((name: string) => {
    if (name === 'get_company_management_context') {
      return { maybeSingle: async () => ({ data: { owner_user_id: null }, error: null }) };
    }
    if (name === 'get_company_staff_access_managed') return Promise.resolve({ data: state.staff, error: null });
    if (name === 'get_company_projects_browse' || name === 'get_company_photos_browse') return Promise.resolve({ data: [], error: null });
    throw new Error(`Unexpected RPC: ${name}`);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('company managed staff', () => {
  it('renders a named staff member and email for an owner', async () => {
    state.staff = [{ staff_name: 'Synthetic Editor', email: 'editor@example.test' }];
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Staff' });
    const section = heading.closest('section');
    if (!section) throw new Error('Missing staff section');
    expect(within(section).getByText('Synthetic Editor')).toBeTruthy();
    expect(within(section).getByText('editor@example.test')).toBeTruthy();
    expect(state.rpc).toHaveBeenCalledWith('get_company_staff_access_managed', { _company_id: 'company-1', _staff_token: null });
  });

  it('uses the email and Staff editor label when staff_name is null', async () => {
    state.staff = [{ staff_name: null, email: 'unnamed@example.test' }];
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Staff' });
    const section = heading.closest('section');
    if (!section) throw new Error('Missing staff section');
    expect(within(section).getByText('unnamed@example.test')).toBeTruthy();
    expect(within(section).getByText('Staff editor')).toBeTruthy();
  });

  it('hides the staff section for an authorized empty response without an owner profile', async () => {
    const client = renderPage();
    await waitForQuery(client, ['company-invited-staff', 'company-1', undefined]);
    await waitForQuery(client, ['company-management', 'company-1']);
    await screen.findByRole('heading', { name: 'Synthetic Company' });
    expect(state.rpc).toHaveBeenCalledWith('get_company_staff_access_managed', { _company_id: 'company-1', _staff_token: null });
    expect(screen.queryByRole('heading', { name: 'Staff' })).toBeNull();
  });

  it('does not fetch or show staff when the management gate is disabled', async () => {
    state.isOwner = false;
    const client = renderPage();
    await waitForQuery(client, ['company', 'company-1']);
    await waitForQuery(client, ['company-projects', 'company-1']);
    await waitForQuery(client, ['company-photos', 'company-1']);
    await screen.findByRole('heading', { name: 'Synthetic Company' });
    await waitFor(() => expect(client.getQueryState(['company-invited-staff', 'company-1', undefined])?.fetchStatus).toBe('idle'));
    expect(state.rpc).not.toHaveBeenCalledWith('get_company_staff_access_managed', expect.anything());
    expect(state.rpc).not.toHaveBeenCalledWith('get_company_management_context', expect.anything());
    expect(screen.queryByRole('heading', { name: 'Staff' })).toBeNull();
  });
});
