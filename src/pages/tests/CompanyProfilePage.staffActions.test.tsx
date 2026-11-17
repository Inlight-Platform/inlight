import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyProfilePage from '../CompanyProfilePage';

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  updateError: null as Error | null,
  deleteError: null as Error | null,
}));

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
          data: {
            id: 'company-1', name: 'Synthetic Company', description: 'Description', location: 'Chicago',
            website_url: 'https://example.test', tagline: 'Tagline', mission: 'Mission',
            brand_primary_color: '#112233', brand_accent_color: '#445566', brand_text_color: '#778899',
            logo_url: null, cover_image_url: null, fun_facts: ['  First fact  ', '   ', 'Second fact'], is_owner: false,
          },
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
  state.updateError = null;
  state.deleteError = null;
  state.success.mockReset();
  state.error.mockReset();
  state.rpc.mockReset();
  state.rpc.mockImplementation((name: string) => {
    if (name === 'validate_company_staff_access') return Promise.resolve({ data: [{ company_id: 'company-1', email: 'staff@example.test', staff_name: 'Staff' }], error: null });
    if (name === 'get_company_management_context') return { maybeSingle: async () => ({ data: { owner_user_id: null }, error: null }) };
    if (name === 'get_company_staff_access_managed' || name === 'get_company_projects_browse') return Promise.resolve({ data: [], error: null });
    if (name === 'get_company_photos_browse') return Promise.resolve({ data: [{ id: 'photo-1', image_url: 'https://example.test/photo.jpg', caption: 'Synthetic photo' }], error: null });
    if (name === 'update_company_with_staff_token') return Promise.resolve({ data: state.updateError ? null : 'company-1', error: state.updateError });
    if (name === 'delete_company_photo_with_staff_token') return Promise.resolve({ data: null, error: state.deleteError });
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
  return { client, invalidate };
};
const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Customize Page' }));
  return screen.findByRole('dialog', { name: 'Customize Your Company Page' });
};
const expectedUpdate = {
  _token: 'synthetic-token', _name: 'Synthetic Company', _description: 'Description', _location: 'Chicago',
  _website_url: 'https://example.test', _tagline: 'Tagline', _mission: 'Mission',
  _brand_primary_color: '#112233', _brand_accent_color: '#445566', _brand_text_color: '#778899',
  _logo_url: null, _cover_image_url: null, _fun_facts: ['First fact', 'Second fact'],
};
const photoCalls = () => state.rpc.mock.calls.filter(([name]) => name === 'get_company_photos_browse').length;
const deletePhoto = async () => {
  const image = await screen.findByRole('img', { name: 'Synthetic photo' });
  const container = image.parentElement;
  if (!container) throw new Error('Missing photo container');
  fireEvent.click(within(container).getByRole('button'));
};

describe('company staff-token actions', () => {
  it('saves the full company payload and performs success invalidations', async () => {
    const { invalidate } = await renderPage();
    const dialog = await openEditor();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Company updated'));
    expect(state.rpc).toHaveBeenCalledWith('update_company_with_staff_token', expectedUpdate);
    expect(invalidate.mock.calls.filter(([filters]) => JSON.stringify(filters.queryKey) === JSON.stringify(['company', 'company-1']))).toHaveLength(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['companies'] });
    expect(screen.queryByRole('dialog', { name: 'Customize Your Company Page' })).toBeNull();
  });

  it('keeps the editor open and does not invalidate on save failure', async () => {
    state.updateError = new Error('Synthetic save failure');
    const { invalidate } = await renderPage();
    const dialog = await openEditor();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Synthetic save failure'));
    expect(state.rpc).toHaveBeenCalledWith('update_company_with_staff_token', expectedUpdate);
    expect(state.success).not.toHaveBeenCalledWith('Company updated');
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Customize Your Company Page' })).toBeTruthy();
  });

  it('deletes the selected photo and refetches photos on success', async () => {
    await renderPage();
    const baseline = photoCalls();
    await deletePhoto();
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Photo deleted'));
    expect(state.rpc).toHaveBeenCalledWith('delete_company_photo_with_staff_token', { _token: 'synthetic-token', _photo_id: 'photo-1' });
    await waitFor(() => expect(photoCalls()).toBe(baseline + 1));
  });

  it('shows the current failure feedback without refetching after a delete error', async () => {
    state.deleteError = new Error('Synthetic delete failure');
    await renderPage();
    const baseline = photoCalls();
    await deletePhoto();
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Failed to delete photo'));
    expect(state.rpc).toHaveBeenCalledWith('delete_company_photo_with_staff_token', { _token: 'synthetic-token', _photo_id: 'photo-1' });
    expect(state.success).not.toHaveBeenCalledWith('Photo deleted');
    expect(photoCalls()).toBe(baseline);
  });
});
