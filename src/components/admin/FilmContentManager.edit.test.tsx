import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import FilmContentManager from './FilmContentManager';

const mocks = vi.hoisted(() => ({
  update: vi.fn(), eq: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const rows: Record<string, unknown[]> = {
        film_metrics: [{ id: 'film-1', title: 'Synthetic Film', studio: 'Synthetic Studio', rating: 4.5, poster_url: null, date: '2026-05-10', ticket_url: null }],
        streaming_content: [{ id: 'stream-1', title: 'Synthetic Stream', content_type: 'tv', platform: 'Netflix', description: 'Synthetic description', poster_url: null, genre: 'Drama', release_year: 2024, rating: 4, watch_url: 'https://example.test/watch' }],
      };
      const result = { data: rows[table] || [], error: null };
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        eq: (column: string, value: unknown) => { mocks.eq(table, column, value); return chain; },
        update: (payload: unknown) => { mocks.update(table, payload); return chain; },
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  },
}));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { mocks.update.mockReset(); mocks.eq.mockReset(); mocks.success.mockReset(); mocks.error.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderManager = (contentType: 'theatres' | 'streaming') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><FilmContentManager contentType={contentType} /></QueryClientProvider>);
};
const openEdit = async (title: string) => {
  const row = (await screen.findByText(title)).closest('tr');
  if (!(row instanceof HTMLElement)) throw new Error('Missing content row');
  // The row renders its unlabeled edit button before its delete button.
  const buttons = within(row).getAllByRole('button');
  if (buttons.length !== 2) throw new Error('Expected edit and delete buttons');
  fireEvent.click(buttons[0]);
  return screen.findByRole('dialog');
};

describe('FilmContentManager edit flows', () => {
  it('updates the selected theatre film with its current form values', async () => {
    renderManager('theatres');
    const dialog = await openEdit('Synthetic Film');
    expect(within(dialog).getByRole('heading', { name: 'Edit: Synthetic Film' })).toBeTruthy();
    mocks.eq.mockClear();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('film_metrics', {
      title: 'Synthetic Film', studio: 'Synthetic Studio', rating: 4.5, poster_url: null, date: '2026-05-10',
    }));
    expect(mocks.eq).toHaveBeenCalledWith('film_metrics', 'id', 'film-1');
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Film updated successfully'));
  });

  it('updates the selected streaming item with its current form values', async () => {
    renderManager('streaming');
    const dialog = await openEdit('Synthetic Stream');
    expect(within(dialog).getByRole('heading', { name: 'Edit: Synthetic Stream' })).toBeTruthy();
    mocks.eq.mockClear();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('streaming_content', {
      title: 'Synthetic Stream', content_type: 'tv', platform: 'Netflix', description: 'Synthetic description',
      poster_url: '', genre: 'Drama', release_year: 2024, rating: 4, watch_url: 'https://example.test/watch',
    }));
    expect(mocks.eq).toHaveBeenCalledWith('streaming_content', 'id', 'stream-1');
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Content updated successfully'));
  });
});
