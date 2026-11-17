import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StageWhisperPage from '../StageWhisperPage';

const state = vi.hoisted(() => ({
  admin: true, deleteError: null as Error | null,
  from: vi.fn(), del: vi.fn(), eq: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: state.admin }) }));
vi.mock('@/hooks/useSavedShows', () => ({ useSavedShows: () => ({ isSaved: () => false, saveShow: vi.fn(), unsaveShow: vi.fn(), savedShowIds: [] }) }));
vi.mock('@/hooks/useSavedFilms', () => ({ useSavedFilms: () => ({ isFilmSaved: () => false, saveFilm: vi.fn(), unsaveFilm: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/components/stage-whisper/ShowDetailSheet', () => ({ ShowDetailSheet: () => null }));
vi.mock('@/components/stage-whisper/FilmDetailSheet', () => ({ FilmDetailSheet: () => null }));
vi.mock('@/components/stage-whisper/MyShowList', () => ({ MyShowList: () => null }));
vi.mock('@/components/stage-whisper/AddShowDialog', () => ({ AddShowDialog: () => null }));
vi.mock('@/components/stage-whisper/AddFilmDialog', () => ({ AddFilmDialog: () => null }));
vi.mock('@/components/stage-whisper/AddMusicShowDialog', () => ({ AddMusicShowDialog: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      state.from(table);
      const show = { id: 'show-active', title: 'Active Show', venue: 'Venue', borough: 'Manhattan', category: 'off-off-broadway', show_type: 'play', price_tier: 'budget', run_end: null, accessibility_features: null };
      const data: Record<string, unknown[]> = {
        nyc_shows_browse: [show, { ...show, id: 'show-past', title: 'Past Show', run_end: '2000-01-01' }],
        film_metrics: [{ id: 'film-1', title: 'Film', studio: 'Studio', rating: 1, date: new Date().toISOString() }],
        user_films_browse: [{ id: 'community-1', title: 'Community Film', link_url: 'https://example.test/film' }],
        user_music_shows_browse: [
          { id: 'music-active', title: 'Active Music', show_type: 'concert', show_date: null },
          { id: 'music-past', title: 'Past Music', show_type: 'concert', show_date: '2000-01-01' },
        ],
      };
      const result = { data: data[table] || [], error: null };
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
        delete: () => { state.del(table); return { eq: async (column: string, id: string) => { state.eq(column, id); return { error: state.deleteError }; } }; },
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  },
}));

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<MemoryRouter><QueryClientProvider client={client}><StageWhisperPage /></QueryClientProvider></MemoryRouter>);
  return invalidate;
};
beforeEach(() => {
  state.admin = true; state.deleteError = null;
  state.from.mockReset(); state.del.mockReset(); state.eq.mockReset(); state.success.mockReset(); state.error.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false });
const confirm = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

describe('Stage Whisper admin deletion', () => {
  it.each([
    ['active show', 'show-active', 'nyc_shows'],
    ['archived show', 'show-past', 'nyc_shows'],
    ['theatre film', 'film-1', 'film_metrics'],
    ['community film', 'community-1', 'user_films'],
    ['active music', 'music-active', 'user_music_shows'],
    ['archived music', 'music-past', 'user_music_shows'],
  ])('confirms %s against its selected table and ID', async (kind, id, table) => {
    const invalidate = renderPage();
    await screen.findByText('Active Show');
    if (kind.includes('film')) {
      openTab('Film');
      if (kind === 'community film') fireEvent.click(screen.getByRole('button', { name: /community/i }));
    }
    if (kind.includes('music')) openTab('Music');
    if (kind.includes('archived')) fireEvent.click(await screen.findByRole('button', { name: /history/i }));
    const title = kind.includes('film') ? 'Delete film' : 'Delete show';
    const button = await screen.findByTitle(title);
    if (kind === 'community film') {
      const event = createEvent.click(button, { bubbles: true, cancelable: true });
      fireEvent(button, event);
      expect(event.defaultPrevented).toBe(true);
    } else fireEvent.click(button);
    expect(state.del).not.toHaveBeenCalled();
    confirm();
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Item deleted successfully'));
    expect(state.del).toHaveBeenCalledWith(table);
    expect(state.eq).toHaveBeenCalledWith('id', id);
    for (const queryKey of [['nyc-shows'], ['film-metrics'], ['user-films'], ['user-music-shows']]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
  });

  it('cancels without deleting', async () => {
    renderPage();
    fireEvent.click(await screen.findByTitle('Delete show'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(state.del).not.toHaveBeenCalled();
  });

  it('shows failure feedback for a returned delete error', async () => {
    state.deleteError = new Error('failed');
    renderPage();
    fireEvent.click(await screen.findByTitle('Delete show'));
    confirm();
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Failed to delete. Please try again.'));
    expect(state.success).not.toHaveBeenCalled();
  });

  it('does not expose delete controls to a non-admin', async () => {
    state.admin = false;
    renderPage();
    await screen.findByText('Active Show');
    expect(screen.queryByTitle('Delete show')).toBeNull();
    openTab('Film');
    await screen.findByText('Studio');
    expect(screen.queryByTitle('Delete film')).toBeNull();
    openTab('Music');
    await screen.findByText('Active Music');
    expect(screen.queryByTitle('Delete show')).toBeNull();
    expect(state.del).not.toHaveBeenCalled();
  });
});
