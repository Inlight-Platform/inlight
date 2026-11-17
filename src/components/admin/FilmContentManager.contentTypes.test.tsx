import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import FilmContentManager from './FilmContentManager';

const mocks = vi.hoisted(() => ({
  contentType: 'movie',
  update: vi.fn(),
  eq: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const result = {
        data: table === 'streaming_content' ? [{
          id: 'stream-1', title: 'Synthetic Stream', content_type: mocks.contentType,
          platform: 'Netflix', description: 'Synthetic description', poster_url: null,
          genre: 'Drama', release_year: 2024, rating: 4,
          watch_url: 'https://example.test/watch',
        }] : [],
        error: null,
      };
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
beforeEach(() => {
  mocks.contentType = 'movie';
  mocks.update.mockReset();
  mocks.eq.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const expectEditPreservesType = async (contentType: string, badge: string) => {
  mocks.contentType = contentType;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><FilmContentManager contentType="streaming" /></QueryClientProvider>);

  const row = (await screen.findByText('Synthetic Stream')).closest('tr');
  if (!(row instanceof HTMLElement)) throw new Error('Missing streaming content row');
  expect(within(row).getByText(badge)).toBeTruthy();
  const buttons = within(row).getAllByRole('button');
  if (buttons.length !== 2) throw new Error('Expected edit and delete buttons');
  fireEvent.click(buttons[0]);

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'Edit: Synthetic Stream' })).toBeTruthy();
  mocks.eq.mockClear();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('streaming_content', {
    title: 'Synthetic Stream', content_type: contentType, platform: 'Netflix',
    description: 'Synthetic description', poster_url: '', genre: 'Drama',
    release_year: 2024, rating: 4, watch_url: 'https://example.test/watch',
  }));
  expect(mocks.eq).toHaveBeenCalledWith('streaming_content', 'id', 'stream-1');
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Content updated successfully'));
};

describe('FilmContentManager streaming content types', () => {
  it('displays and preserves a movie type', async () => {
    await expectEditPreservesType('movie', 'Movie');
  });

  it('displays and preserves a tv type', async () => {
    await expectEditPreservesType('tv', 'TV');
  });

  it('displays the existing Movie badge and preserves an unsupported type', async () => {
    await expectEditPreservesType('documentary', 'Movie');
  });
});
