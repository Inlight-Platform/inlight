import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyProfilePage from '../CompanyProfilePage';

const state = vi.hoisted(() => ({ rpc: vi.fn(), success: vi.fn(), error: vi.fn(), createError: null as Error | null }));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false, isLoading: false }) }));
vi.mock('@/hooks/useCompanyFollows', () => ({
  useCompanyFollows: () => ({ isFollowingCompany: () => false, followCompany: { mutate: vi.fn() }, unfollowCompany: { mutate: vi.fn() } }),
}));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
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
    },
  },
}));

const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: () => {} });
});
afterAll(() => {
  vi.unstubAllGlobals();
  if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});
beforeEach(() => {
  state.createError = null;
  state.rpc.mockReset();
  state.success.mockReset();
  state.error.mockReset();
  state.rpc.mockImplementation((name: string) => {
    if (name === 'validate_company_staff_access') return Promise.resolve({ data: [{ company_id: 'company-1', email: 'staff@example.test', staff_name: 'Staff' }], error: null });
    if (name === 'get_company_management_context') return { maybeSingle: async () => ({ data: { owner_user_id: null }, error: null }) };
    if (name === 'get_company_staff_access_managed' || name === 'get_company_projects_browse' || name === 'get_company_photos_browse') return Promise.resolve({ data: [], error: null });
    if (name === 'create_company_project_with_staff_token') return Promise.resolve({ data: state.createError ? null : 'project-1', error: state.createError });
    throw new Error(`Unexpected RPC: ${name}`);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderPage = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<MemoryRouter initialEntries={['/company-edit/synthetic-token']}><QueryClientProvider client={client}>
    <Routes><Route path="/company-edit/:token" element={<CompanyProfilePage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  for (const key of [
    ['company-staff-access', 'synthetic-token'], ['company', 'company-1'], ['company-management', 'company-1'],
    ['company-invited-staff', 'company-1', 'synthetic-token'], ['company-follower-count', 'company-1'],
    ['company-projects', 'company-1'], ['company-photos', 'company-1'],
  ]) await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByRole('heading', { name: 'Synthetic Company' });
  invalidate.mockClear();
  return { invalidate };
};
const openProject = async () => {
  const section = (await screen.findByRole('heading', { name: 'Current Projects' })).closest('section');
  if (!section) throw new Error('Missing current projects section');
  fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
  return screen.findByRole('dialog', { name: 'Add Current Project' });
};
const fillProject = (dialog: HTMLElement) => {
  fireEvent.change(within(dialog).getByLabelText('Project title'), { target: { value: '  Synthetic Project  ' } });
  fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: '  Synthetic description  ' } });
  fireEvent.change(within(dialog).getByLabelText('Start date'), { target: { value: '2026-12-01' } });
  fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2026-12-10' } });
  fireEvent.change(within(dialog).getByLabelText('Link title'), { target: { value: '  Trailer  ' } });
  fireEvent.change(within(dialog).getByLabelText('Link URL'), { target: { value: 'https://example.test/project' } });
};
const expectedPayload = {
  _token: 'synthetic-token', _title: 'Synthetic Project', _description: 'Synthetic description',
  _category: 'other', _status: 'active', _main_image_url: null,
  _start_date: '2026-12-01', _end_date: '2026-12-10',
  _link_title: 'Trailer', _link_url: 'https://example.test/project',
};

describe('staff current-project creation', () => {
  it('creates a project, invalidates current queries, and resets the form', async () => {
    const { invalidate } = await renderPage();
    const dialog = await openProject();
    fillProject(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Current Project' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Current project added to company'));
    expect(state.rpc).toHaveBeenCalledWith('create_company_project_with_staff_token', expectedPayload);
    expect(invalidate.mock.calls.filter(([filters]) => JSON.stringify(filters.queryKey) === JSON.stringify(['company-projects', 'company-1']))).toHaveLength(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects-feed'] });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Current Project' })).toBeNull());
    const reopened = await openProject();
    expect(within(reopened).getByLabelText('Project title')).toHaveValue('');
    expect(within(reopened).getByLabelText('Description')).toHaveValue('');
    expect(within(reopened).getByLabelText('Start date')).toHaveValue('');
    expect(within(reopened).getByLabelText('End date')).toHaveValue('');
    expect(within(reopened).getByLabelText('Link title')).toHaveValue('');
    expect(within(reopened).getByLabelText('Link URL')).toHaveValue('');
  });

  it('keeps the project form and skips success invalidations after an RPC error', async () => {
    state.createError = new Error('Synthetic project failure');
    const { invalidate } = await renderPage();
    const dialog = await openProject();
    fillProject(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Current Project' }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic project failure'));
    expect(state.rpc).toHaveBeenCalledWith('create_company_project_with_staff_token', expectedPayload);
    expect(state.success).not.toHaveBeenCalledWith('Current project added to company');
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Add Current Project' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Project title')).toHaveValue('  Synthetic Project  ');
    expect(within(dialog).getByLabelText('Description')).toHaveValue('  Synthetic description  ');
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-12-01');
    expect(within(dialog).getByLabelText('End date')).toHaveValue('2026-12-10');
    expect(within(dialog).getByLabelText('Link title')).toHaveValue('  Trailer  ');
    expect(within(dialog).getByLabelText('Link URL')).toHaveValue('https://example.test/project');
  });
});
