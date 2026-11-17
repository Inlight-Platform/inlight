import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import MessagesPage from '../MessagesPage';

const mocks = vi.hoisted(() => ({ minimize: vi.fn() }));
const conversations = [{ user_id: 'sender', display_name: 'Synthetic Sender', avatar_url: null, unread_count: 0 }];
const messages: never[] = [];
const groupChats: never[] = [];

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' }, loading: false }) }));
vi.mock('@/hooks/useSavedShows', () => ({ useSavedShows: () => ({ isSaved: () => false, saveShow: vi.fn(), unsaveShow: vi.fn() }) }));
vi.mock('@/hooks/useSavedFilms', () => ({ useSavedFilms: () => ({ isFilmSaved: () => false, saveFilm: vi.fn(), unsaveFilm: vi.fn() }) }));
vi.mock('@/hooks/useMinimizedChat', () => ({ useMinimizedChat: () => ({ minimize: mocks.minimize }) }));
vi.mock('@/hooks/useMessages', () => ({
  useMessages: () => ({
    conversations, loadingConversations: false,
    useConversation: () => ({ data: messages, isLoading: false }),
    sendMessage: { mutateAsync: vi.fn() }, markAsRead: { mutate: vi.fn() },
  }),
}));
vi.mock('@/hooks/useGroupChats', () => ({ useGroupChats: () => ({ groupChats, loadingGroupChats: false }) }));
vi.mock('@/components/stage-whisper/ShowDetailSheet', () => ({ ShowDetailSheet: () => null }));
vi.mock('@/components/stage-whisper/FilmDetailSheet', () => ({ FilmDetailSheet: () => null }));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({ default: () => null }));
vi.mock('@/components/opportunities/ApplicationDialog', () => ({ default: () => null }));
vi.mock('@/components/messages/NewGroupMessageDialog', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: [], error: null }) },
}));

const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: () => {} });
});
afterAll(() => {
  if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});
beforeEach(() => { mocks.minimize.mockReset(); });
afterEach(() => { cleanup(); });

const renderPage = (routeState?: unknown) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/previous', { pathname: '/messages/direct/sender', state: routeState }]} initialIndex={1}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/messages/direct/:userId" element={<MessagesPage />} />
          <Route path="/origin" element={<div>Origin destination</div>} />
          <Route path="/previous" element={<div>Previous destination</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const clickMinimize = async (container: HTMLElement) => {
  await screen.findByText('Synthetic Sender');
  await waitFor(() => expect(container.querySelector('svg.lucide-minimize2')).not.toBeNull());
  const button = container.querySelector('svg.lucide-minimize2')?.closest('button');
  if (!button) throw new Error('Missing minimize button');
  fireEvent.click(button);
};

describe('MessagesPage origin route', () => {
  it('minimizes and navigates to a string origin', async () => {
    const { container } = renderPage({ originRoute: '/origin' });
    await clickMinimize(container);
    expect(mocks.minimize).toHaveBeenCalledWith('/origin', '/messages/direct/sender');
    expect(await screen.findByText('Origin destination')).toBeTruthy();
  });

  it('navigates back when location state is missing', async () => {
    const { container } = renderPage();
    await clickMinimize(container);
    expect(mocks.minimize).not.toHaveBeenCalled();
    expect(await screen.findByText('Previous destination')).toBeTruthy();
  });

  it('navigates back instead of minimizing for a truthy non-string origin', async () => {
    const { container } = renderPage({ originRoute: { pathname: '/origin' } });
    await clickMinimize(container);
    expect(mocks.minimize).not.toHaveBeenCalled();
    expect(await screen.findByText('Previous destination')).toBeTruthy();
  });
});
