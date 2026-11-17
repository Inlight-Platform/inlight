import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyProfilePage from '../CompanyProfilePage';

const state = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false, isLoading: false }) }));
vi.mock('@/hooks/useCompanyFollows', () => ({ useCompanyFollows: () => ({ isFollowingCompany: () => false, followCompany: { mutate: vi.fn() }, unfollowCompany: { mutate: vi.fn() } }) }));
vi.mock('@/lib/imageCompression', () => ({ isCompressibleImage: () => false, compressImage: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc, functions: { invoke: state.invoke },
    from: (table: string) => {
      const result = () => {
        if (table === 'company_follows') return { data: null, count: 0, error: null };
        if (table === 'companies_browse') return { data: { id: 'company-1', name: 'Synthetic Company', description: 'Description', location: 'Chicago', website_url: null, tagline: null, mission: null, brand_primary_color: null, brand_accent_color: null, brand_text_color: null, logo_url: null, cover_image_url: null, fun_facts: [], is_owner: false }, error: null };
        throw new Error('Unexpected table: ' + table);
      };
      const query = { select: () => query, eq: () => query, single: async () => result(), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) };
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
  state.rpc.mockReset(); state.invoke.mockReset(); state.success.mockReset(); state.error.mockReset();
  state.rpc.mockImplementation((name: string) => {
    if (name === 'validate_company_staff_access') return Promise.resolve({ data: [{ company_id: 'company-1', email: 'staff@example.test', staff_name: 'Staff' }], error: null });
    if (name === 'get_company_management_context') return { maybeSingle: async () => ({ data: { owner_user_id: null }, error: null }) };
    if (name === 'get_company_staff_access_managed' || name === 'get_company_projects_browse' || name === 'get_company_photos_browse') return Promise.resolve({ data: [], error: null });
    throw new Error('Unexpected RPC: ' + name);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const photoCalls = () => state.rpc.mock.calls.filter(([name]) => name === 'get_company_photos_browse').length;
const renderPage = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<MemoryRouter initialEntries={['/company-edit/synthetic-token']}><QueryClientProvider client={client}>
    <Routes><Route path="/company-edit/:token" element={<CompanyProfilePage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  for (const key of [['company-staff-access', 'synthetic-token'], ['company', 'company-1'], ['company-management', 'company-1'], ['company-invited-staff', 'company-1', 'synthetic-token'], ['company-follower-count', 'company-1'], ['company-projects', 'company-1'], ['company-photos', 'company-1']]) {
    await waitFor(() => expect(client.getQueryState(key)?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByRole('heading', { name: 'Synthetic Company' });
  const photos = screen.getByRole('heading', { name: 'Photos' }).closest('section');
  if (!(photos instanceof HTMLElement)) throw new Error('Missing photos controls');
  const input = photos.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Missing photo input');
  return { input, baseline: photoCalls(), view };
};
const upload = (input: HTMLInputElement) => {
  fireEvent.change(input, { target: { files: [new File(['abc'], 'synthetic.gif', { type: 'image/gif' })] } });
};
const expected = { body: { token: 'synthetic-token', kind: 'photo', fileName: 'synthetic.gif', contentType: 'image/gif', fileBase64: 'YWJj' } };
describe('staff-token photo upload', () => {
  it('sends the exact media payload and refetches photos on success', async () => {
    state.invoke.mockResolvedValue({ data: { publicUrl: 'https://example.test/photo.gif', photoId: 'photo-1' }, error: null });
    const { input, baseline } = await renderPage(); upload(input);
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Photo uploaded!'));
    expect(state.invoke).toHaveBeenCalledWith('company-staff-media', expected);
    await waitFor(() => expect(photoCalls()).toBe(baseline + 1));
  });
  it('reports an error payload without success or refetch', async () => {
    state.invoke.mockResolvedValue({ data: { error: 'Synthetic media failure' }, error: null });
    const { input, baseline } = await renderPage(); upload(input);
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic media failure'));
    expect(state.invoke).toHaveBeenCalledWith('company-staff-media', expected);
    expect(state.success).not.toHaveBeenCalledWith('Photo uploaded!');
    expect(photoCalls()).toBe(baseline);
  });
  it('reports an invoke error without success or refetch', async () => {
    state.invoke.mockResolvedValue({ data: null, error: new Error('Synthetic invoke failure') });
    const { input, baseline } = await renderPage(); upload(input);
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic invoke failure'));
    expect(state.invoke).toHaveBeenCalledWith('company-staff-media', expected);
    expect(state.success).not.toHaveBeenCalledWith('Photo uploaded!');
    expect(photoCalls()).toBe(baseline);
  });
});
