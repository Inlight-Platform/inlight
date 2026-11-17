import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '../ProfilePage';

const state = vi.hoisted(() => ({
  flag: null as boolean | null | undefined,
  rows: [] as Array<{ id: string; saved_at: string; show_id: string; title: string; venue: string; borough: string | null; show_type: string; poster_url: string | null; run_start: string | null; run_end: string | null; official_url: string | null }>,
  rpcError: null as Error | null,
  rpc: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  updateError: null as Error | null,
}));

vi.mock('sonner', () => ({ toast: { success: state.toastSuccess, error: state.toastError } }));
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
      const profile = { user_id: 'profile', display_name: 'Watchlist Person', skills: ['Singing'], badges: ['etw'], watchlist_public: state.flag };
      const result = () => ({ data: [], error: null });
      const chain = {
        update: (payload: unknown) => { state.update(payload); return { eq: async () => ({ error: state.updateError }) }; },
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
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<MemoryRouter initialEntries={['/profile/owner']}><QueryClientProvider client={client}>
    <Routes><Route path="/profile/:userId" element={<ProfilePage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  return { invalidate };
};

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: () => {},
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  }
});

beforeEach(() => {
  state.flag = false;
  state.updateError = null;
  state.rpc.mockReset();
  state.update.mockReset();
  state.toastSuccess.mockReset();
  state.toastError.mockReset();
  state.rpc.mockResolvedValue({ data: [], error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ProfilePage field updates', () => {
  it('trims the name, rejects an empty name, and invalidates on success', async () => {
    const { invalidate } = renderPage();
    fireEvent.click(await screen.findByText('Watchlist Person'));
    const input = screen.getByDisplayValue('Watchlist Person');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(state.update).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ display_name: 'New Name' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile', 'owner'] }));
    expect(state.toastSuccess).toHaveBeenCalledWith('Profile updated!');
  });

  it('sends the trimmed role through the role editor', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit headline' }));
    const input = screen.getByPlaceholderText('Roles (comma separated)');
    fireEvent.change(input, { target: { value: '  Actor  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ role: 'Actor' }));
  });

  it('sends a trimmed custom location through the location editor', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('add location'));
    const locationButton = screen.getByText('Select location...').closest('button');
    const editor = locationButton?.parentElement?.parentElement;
    if (!locationButton || !editor) throw new Error('Missing location editor');
    fireEvent.click(locationButton);
    fireEvent.change(screen.getByPlaceholderText('Search cities...'), { target: { value: '  Testville  ' } });
    fireEvent.click(await screen.findByText('Add "Testville"'));
    const save = editor.querySelector('svg.lucide-save')?.closest('button');
    if (!save) throw new Error('Missing location save button');
    fireEvent.click(save);
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ location: 'Testville' }));
  });

  it('sends null when the empty location is saved', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('add location'));
    const locationButton = screen.getByText('Select location...').closest('button');
    const editor = locationButton?.parentElement?.parentElement;
    if (!editor) throw new Error('Missing location editor');
    const save = editor.querySelector('svg.lucide-save')?.closest('button');
    if (!save) throw new Error('Missing location save button');
    fireEvent.click(save);
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ location: null }));
  });

  it('sends the trimmed biography', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Add a bio to let others know who you are'));
    fireEvent.change(screen.getByPlaceholderText(/Tell your story/), { target: { value: '  My bio  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ bio: 'My bio' }));
  });

  it('sends the badges array when a badge is removed', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove etw badge' }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ badges: [] }));
  });

  it('sends the skills array when a skill is removed', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /skills/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Singing skill' }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ skills: [] }));
  });

  it('shows the existing error message on a failed update', async () => {
    state.updateError = new Error('save failed');
    const { invalidate } = renderPage();
    fireEvent.click(await screen.findByText('Watchlist Person'));
    const input = screen.getByDisplayValue('Watchlist Person');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(state.toastError).toHaveBeenCalledWith('save failed'));
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['profile', 'owner'] });
    expect(screen.getByDisplayValue('New Name')).toBeTruthy();
  });
});
