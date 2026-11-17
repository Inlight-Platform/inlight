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
  postRows: [] as Array<{ id: string }>,
  eventRows: [] as Array<{ id: string }>,
  failing: '',
  localUser: false,
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
    currentUserId: 'owner', getUser: () => state.localUser ? { id: 'other', name: 'Watchlist Person', role: '' } : undefined, getConnectionStatus: () => null,
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

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={['/profile/other']}><QueryClientProvider client={client}>
    <Routes><Route path="/profile/:userId" element={<ProfilePage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  return client;
};

beforeEach(() => {
  state.flag = false;
  state.localUser = false;
  state.postRows = [];
  state.eventRows = [];
  state.failing = '';
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name === 'get_public_profile_posts' || name === 'get_public_profile_events') {
      return { data: state.failing === name ? null : name.endsWith('posts') ? state.postRows : state.eventRows,
        error: state.failing === name ? new Error('activity failure') : null };
    }
    return { data: [], error: null };
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ProfilePage public activity', () => {
  it.each([
    ['get_public_profile_posts', 'postRows'],
    ['get_public_profile_events', 'eventRows'],
  ] as const)('opens Posts for a nonempty %s result', async (rpcName, rowsKey) => {
    state[rowsKey] = [{ id: 'activity-1' }];
    const client = renderPage();
    const posts = await screen.findByRole('button', { name: /^posts$/i });
    await waitFor(() => expect(client.getQueryState(['profile-section-content', 'other', false, null])?.status).toBe('success'));
    await waitFor(() => expect(posts.getAttribute('aria-expanded')).toBe('true'));
    expect(state.rpc).toHaveBeenCalledWith(rpcName, { _user_id: 'other' });
  });

  it('keeps Posts closed when both results are empty', async () => {
    const client = renderPage();
    const posts = await screen.findByRole('button', { name: /^posts$/i });
    await waitFor(() => expect(client.getQueryState(['profile-section-content', 'other', false, null])?.status).toBe('success'));
    expect(posts.getAttribute('aria-expanded')).toBe('false');
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_posts', { _user_id: 'other' });
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_events', { _user_id: 'other' });
  });

  it.each(['get_public_profile_posts', 'get_public_profile_events'])('treats a %s response error with null data as empty', async (rpcName) => {
    state.failing = rpcName;
    const client = renderPage();
    const posts = await screen.findByRole('button', { name: /^posts$/i });
    await waitFor(() => expect(client.getQueryState(['profile-section-content', 'other', false, null])?.status).toBe('success'));
    expect(state.rpc).toHaveBeenCalledWith(rpcName, { _user_id: 'other' });
    expect(posts.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses table queries and skips both RPCs when the store has a user', async () => {
    state.localUser = true;
    const client = renderPage();
    await screen.findByRole('button', { name: /^posts$/i });
    await waitFor(() => expect(client.getQueryState(['profile-section-content', 'other', false, null])?.status).toBe('success'));
    expect(state.rpc).not.toHaveBeenCalledWith('get_public_profile_posts', expect.anything());
    expect(state.rpc).not.toHaveBeenCalledWith('get_public_profile_events', expect.anything());
  });
});
