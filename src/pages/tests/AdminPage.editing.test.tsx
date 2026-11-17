import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '../AdminPage';

const state = vi.hoisted(() => ({
  studio: { name: 'Synthetic Studio' } as { name: string } | null,
  update: vi.fn(), eq: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' }, loading: false }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: true, isLoading: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let updating = false;
      const rows = table === 'industry_highlights'
        ? [{ id: 'highlight-1', content: 'Original highlight', category: 'film', date: '2026-01-02', created_at: '2026-01-02T00:00:00Z' }]
        : table === 'studio_posts'
          ? [{ id: 'post-1', content: null, image_url: null, studios: state.studio }]
          : [];
      const chain = {
        select: () => chain, order: () => chain, limit: () => chain,
        update: (payload: unknown) => { updating = true; state.update(table, payload); return chain; },
        eq: (column: string, value: string) => { if (updating) state.eq(column, value); return chain; },
        then: (resolve: (value: { data: unknown[] | null; error: null }) => unknown) =>
          Promise.resolve({ data: updating ? null : rows, error: null }).then(resolve),
      };
      return chain;
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
beforeEach(() => { state.studio = { name: 'Synthetic Studio' }; state.update.mockReset(); state.eq.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderPage = (tab: 'highlights' | 'photos') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={[`/admin?tab=${tab}`]}><QueryClientProvider client={client}><AdminPage /></QueryClientProvider></MemoryRouter>);
  return client;
};
const openHighlight = async () => {
  const row = (await screen.findByText('Original highlight')).closest('tr');
  if (!row) throw new Error('Missing highlight row');
  fireEvent.click(within(row).getAllByRole('button')[0]);
  return screen.findByRole('dialog');
};

describe('admin highlights and studio photos', () => {
  it('populates the highlight editor with existing values', async () => {
    renderPage('highlights');
    const dialog = await openHighlight();
    expect(within(dialog).getByPlaceholderText('Enter highlight content...')).toHaveValue('Original highlight');
    expect(within(dialog).getByRole('combobox')).toHaveTextContent('Film');
    const date = dialog.querySelector('input[type="date"]');
    expect(date).toHaveValue('2026-01-02');
  });

  it('updates the selected highlight with edited values', async () => {
    renderPage('highlights');
    const dialog = await openHighlight();
    fireEvent.change(within(dialog).getByPlaceholderText('Enter highlight content...'), { target: { value: 'Edited highlight' } });
    const date = dialog.querySelector('input[type="date"]');
    if (!date) throw new Error('Missing date input');
    fireEvent.change(date, { target: { value: '2026-02-03' } });
    fireEvent.keyDown(within(dialog).getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Broadway' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith('industry_highlights', {
      content: 'Edited highlight', category: 'broadway', date: '2026-02-03',
    }));
    expect(state.eq).toHaveBeenCalledWith('id', 'highlight-1');
  });

  it('renders the related studio name with null content and image', async () => {
    renderPage('photos');
    expect(await screen.findByText('Synthetic Studio')).toBeTruthy();
    expect(screen.queryByAltText('Studio post')).toBeNull();
  });

  it('renders safely when the studio relation is null', async () => {
    state.studio = null;
    const client = renderPage('photos');
    await waitFor(() => expect(client.getQueryState(['admin-studio-posts'])?.status).toBe('success'));
    expect(screen.getByRole('heading', { name: 'Studio Photos' })).toBeTruthy();
    expect(screen.queryByText('Synthetic Studio')).toBeNull();
    expect(screen.queryByAltText('Studio post')).toBeNull();
  });
});
