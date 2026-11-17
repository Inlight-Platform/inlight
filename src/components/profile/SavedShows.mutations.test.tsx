import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedShows } from './SavedShows';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

const show = {
  id: 'saved-show', saved_at: '2026-01-01T00:00:00Z', show_id: 'show-1',
  title: 'Stage Show', venue: 'Theatre', borough: 'Manhattan', show_type: 'play',
  poster_url: null, run_start: null, run_end: null, official_url: null,
};
const film = {
  ...show, id: 'saved-film', show_id: 'film-1', title: 'Film', show_type: 'film', borough: null,
};

const deferred = () => {
  let resolve: (value: { error: Error | null }) => void = () => { throw new Error('Mutation not started'); };
  const promise = new Promise<{ error: Error | null }>((complete) => { resolve = complete; });
  return { promise, resolve };
};

const renderSavedShows = (watchlistPublic = false) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}>
    <SavedShows userId="owner" isOwnProfile watchlistPublic={watchlistPublic} />
  </QueryClientProvider>);
  return { client, invalidate };
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockReset();
  mocks.delete.mockReset();
  mocks.eq.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
  mocks.rpc.mockImplementation(async (name: string) =>
    name === 'get_profile_watchlist' ? { data: [show, film], error: null } : { error: null });
  mocks.from.mockReturnValue({ delete: mocks.delete });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SavedShows mutations', () => {
  it('renders and caches null-borough films in active and history based on run_end', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    try {
      const activeFilm = { ...film, title: 'Future Film', venue: 'Future Studio', run_end: '2026-12-01' };
      const pastFilm = { ...film, id: 'past-save', show_id: 'past-film', title: 'Past Film', venue: 'Past Studio', run_end: '2026-01-01' };
      mocks.rpc.mockImplementation(async (name: string) => name === 'get_profile_watchlist'
        ? { data: [activeFilm, pastFilm], error: null } : { error: null });
      const { client } = renderSavedShows();
      expect(await screen.findByText('Future Film')).toBeTruthy();
      expect(screen.getByText('Future Studio')).toBeTruthy();
      expect(screen.queryByText('Past Film')).toBeNull();
      expect(client.getQueryData(['saved-shows-profile', 'owner'])).toEqual([activeFilm, pastFilm]);
      fireEvent.mouseDown(screen.getByRole('tab', { name: /history/i }), { button: 0, ctrlKey: false });
      expect(await screen.findByText('Past Film')).toBeTruthy();
      expect(screen.getByText('Past Studio')).toBeTruthy();
      expect(screen.queryByText('Future Film')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [false, true, 'Watchlist is now public'],
    [true, false, 'Watchlist is now private'],
  ])('saves privacy from %s to %s', async (initial, value, message) => {
    const { invalidate } = renderSavedShows(initial);
    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('set_watchlist_public', { value }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(message));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['watchlist-public', 'owner'] });
    expect(toggle.getAttribute('data-state')).toBe(value ? 'checked' : 'unchecked');
  });

  it('rolls privacy back after an RPC failure', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'get_profile_watchlist'
      ? { data: [show, film], error: null }
      : { error: new Error('privacy failed') });
    renderSavedShows();
    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('privacy failed'));
    expect(mocks.rpc).toHaveBeenCalledWith('set_watchlist_public', { value: true });
    expect(toggle.getAttribute('data-state')).toBe('unchecked');
  });

  it('optimistically removes a show and invalidates its queries on success', async () => {
    const pending = deferred();
    mocks.rpc.mockImplementation((name: string) => name === 'get_profile_watchlist'
      ? Promise.resolve({ data: [show, film], error: null }) : pending.promise);
    const { client, invalidate } = renderSavedShows();
    await screen.findByText('Stage Show');
    fireEvent.click(screen.getAllByTitle('Remove from watchlist')[0]);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('remove_saved_show', { p_show_id: 'show-1' }));
    await waitFor(() => expect(client.getQueryData(['saved-shows-profile', 'owner'])).toEqual([film]));
    pending.resolve({ error: null });
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Removed from watchlist'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['saved-shows-profile', 'owner'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['saved-show-ids', 'owner'] });
  });

  it('restores the previous list after show removal fails', async () => {
    const pending = deferred();
    mocks.rpc.mockImplementation((name: string) => name === 'get_profile_watchlist'
      ? Promise.resolve({ data: [show, film], error: null }) : pending.promise);
    const { client } = renderSavedShows();
    await screen.findByText('Stage Show');
    fireEvent.click(screen.getAllByTitle('Remove from watchlist')[0]);
    await waitFor(() => expect(client.getQueryData(['saved-shows-profile', 'owner'])).toEqual([film]));
    pending.resolve({ error: new Error('remove failed') });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Failed to remove'));
    expect(client.getQueryData(['saved-shows-profile', 'owner'])).toEqual([show, film]);
  });

  it('removes films using the existing table path', async () => {
    mocks.eq.mockImplementation((column: string) => column === 'film_id'
      ? { eq: mocks.eq } : Promise.resolve({ error: null }));
    const { invalidate } = renderSavedShows();
    await screen.findByText('Film');
    fireEvent.click(screen.getAllByTitle('Remove from watchlist')[1]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Removed from watchlist'));
    expect(mocks.from).toHaveBeenCalledWith('saved_films');
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith('film_id', 'film-1');
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(mocks.rpc).not.toHaveBeenCalledWith('remove_saved_show', expect.anything());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['saved-film-ids', 'owner'] });
  });
});
