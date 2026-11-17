import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '../ProfilePage';

const state = vi.hoisted(() => ({
  flag: null as boolean | null | undefined,
  rows: [] as Array<{ id: string; saved_at: string; show_id: string; title: string; venue: string; borough: string | null; show_type: string; poster_url: string | null; run_start: string | null; run_end: string | null; official_url: string | null }>,
  rpcError: null as Error | null,
  rpc: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useAnalytics', () => ({
  useTrackProfileView: () => {},
  useUpdateEngagement: () => ({ updateEngagement: vi.fn() }),
}));
vi.mock('@/hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({ deleteFile: vi.fn(), updateVisibility: vi.fn() }),
  useUserMedia: () => ({ fetchMedia: async () => [] }),
}));
vi.mock('@/hooks/useVouch', () => ({
  useVouch: () => ({ hasVouched: false, vouchCount: 0, vouch: vi.fn(), unvouch: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useNetworkConnections', () => ({
  useNetworkConnections: () => ({ isFollowing: () => false, isMutual: () => false, follow: vi.fn(), unfollow: vi.fn() }),
}));
vi.mock('@/hooks/useConnectionRequests', () => ({
  useConnectionRequests: () => ({ sendRequest: { mutate: vi.fn() }, cancelRequest: { mutate: vi.fn() }, hasSentRequestTo: () => false, sentRequests: [] }),
}));
vi.mock('@/hooks/useSavedItems', () => ({
  useSavedItems: () => ({ isSaved: () => false, getSavedItem: () => undefined, saveItem: vi.fn(), unsaveItem: vi.fn() }),
}));
vi.mock('@/hooks/useGroups', () => ({ useMyFacultyGroup: () => null }));
vi.mock('@/hooks/useMinimizedChat', () => ({
  useMinimizedChat: () => ({ isMinimized: false, close: vi.fn(), expand: vi.fn() }),
}));
vi.mock('@/store/useStore', () => {
  const store = {
    currentUserId: 'owner', getUser: () => undefined, getConnectionStatus: () => null,
    sendConnectionRequest: vi.fn(), getMaterials: () => [], updateMaterialVisibility: vi.fn(),
  };
  return { useStore: (selector: (value: typeof store) => unknown) => selector(store) };
});
vi.mock('@/components/profile/SavedShows', () => ({
  SavedShows: ({ userId, watchlistPublic }: { userId: string; watchlistPublic: boolean }) =>
    <div data-testid="saved-shows">{userId}:{String(watchlistPublic)}</div>,
}));
vi.mock('@/components/profile/PublicMediaGallery', () => ({ PublicMediaGallery: () => null }));
vi.mock('@/components/profile/WhyIStarted', () => ({ WhyIStarted: () => null }));
vi.mock('@/components/profile/MyProjects', () => ({ MyProjects: () => null }));
vi.mock('@/components/profile/UserPosts', () => ({ UserPosts: () => null }));
vi.mock('@/components/profile/AttendedSection', () => ({ AttendedSection: () => null }));
vi.mock('@/components/profile/SavedProjects', () => ({ SavedProjects: () => null }));
vi.mock('@/components/profile/ProfileCompletionBar', () => ({ default: () => null }));
vi.mock('@/components/messages/FloatingChatButton', () => ({ default: () => null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
      let selection = '';
      const profile = { user_id: 'profile', display_name: 'Watchlist Person', skills: [], badges: [], watchlist_public: state.flag };
      const result = () => ({ data: [], error: null });
      const chain = {
        select: (columns: string) => { selection = columns; return chain; },
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        not: () => chain,
        limit: () => chain,
        order: () => chain,
        maybeSingle: async () => ({
          data: table === 'profiles' || table === 'profiles_public'
            ? selection === 'watchlist_public'
              ? state.flag === undefined ? null : { watchlist_public: state.flag }
              : selection.startsWith('display_name') ? profile : null
            : null,
          error: null,
        }),
        then: (resolve: (value: ReturnType<typeof result>) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve, reject),
      };
      return chain;
    },
  },
}));

const film = {
  id: 'save-1', saved_at: '2026-01-01T00:00:00Z', show_id: 'film-1',
  title: 'Film', venue: 'Studio', borough: null, show_type: 'film',
  poster_url: null, run_start: '2026-01-01', run_end: '2026-01-01', official_url: null,
};

const renderPage = (id: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <MemoryRouter initialEntries={[`/profile/${id}`]}>
      <QueryClientProvider client={client}>
        <Routes><Route path="/profile/:userId" element={<ProfilePage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { client, ...view };
};

beforeEach(() => {
  state.flag = null;
  state.rows = [];
  state.rpcError = null;
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) => name === 'get_profile_watchlist'
    ? { data: state.rpcError ? null : state.rows, error: state.rpcError }
    : { data: [], error: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ProfilePage watchlist', () => {
  it.each([true, false, null, undefined])('loads the own watchlist with flag %s', async (flag) => {
    state.flag = flag;
    renderPage('owner');
    await screen.findByRole('button', { name: /watchlist/i });
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('get_profile_watchlist', { p_user_id: 'owner' }));
    expect(screen.getByRole('button', { name: /watchlist/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it.each([false, null, undefined])('does not query or render another private watchlist for flag %s', async (flag) => {
    state.flag = flag;
    const { client } = renderPage('other');
    await screen.findByText('Watchlist Person');
    await waitFor(() => expect(client.getQueryState(['profile', 'other', false])?.status).toBe('success'));
    expect(state.rpc).not.toHaveBeenCalledWith('get_profile_watchlist', expect.anything());
    expect(screen.queryByRole('button', { name: /watchlist/i })).toBeNull();
  });

  it('loads and expands a public watchlist containing a film with null borough', async () => {
    state.flag = true;
    state.rows = [film];
    const { client } = renderPage('other');
    const trigger = await screen.findByRole('button', { name: /watchlist/i });
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
    expect(state.rpc).toHaveBeenCalledWith('get_profile_watchlist', { p_user_id: 'other' });
    expect(client.getQueryData(['saved-shows-profile', 'other'])).toEqual([film]);
    expect(screen.getByTestId('saved-shows').textContent).toBe('other:true');
  });

  it('keeps a public empty watchlist closed', async () => {
    state.flag = true;
    const { client } = renderPage('other');
    const trigger = await screen.findByRole('button', { name: /watchlist/i });
    await waitFor(() => expect(client.getQueryState(['saved-shows-profile', 'other'])?.status).toBe('success'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(client.getQueryData(['saved-shows-profile', 'other'])).toEqual([]);
  });

  it('records an RPC error and does not auto-expand', async () => {
    state.flag = true;
    state.rpcError = new Error('watchlist failure');
    const { client } = renderPage('other');
    const trigger = await screen.findByRole('button', { name: /watchlist/i });
    await waitFor(() => expect(client.getQueryState(['saved-shows-profile', 'other'])?.status).toBe('error'));
    expect(client.getQueryState(['saved-shows-profile', 'other'])?.error).toBe(state.rpcError);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
