import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupChatThread from './GroupChatThread';
import MessagesPage from '@/pages/MessagesPage';

const state = vi.hoisted(() => ({
  film: null as null | { id: string; title: string; studio: string; weekend_gross: number; total_gross: number; week_change: number; rating: number; weeks_in_release: number; poster_url: string | null; ticket_url: string | null; date: string },
  saved: false,
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), save: vi.fn(), unsave: vi.fn(),
}));
const message = {
  id: 'message-1', sender_id: 'sender', created_at: '2026-01-01T12:00:00Z',
  content: '__SHARED_ITEM__{"type":"Film","title":"Shared Film","url":"/industry-now?filmId=film-1"}__END__',
  sender: { display_name: 'Sender', avatar_url: null },
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' }, loading: false }) }));
vi.mock('@/hooks/useSavedShows', () => ({ useSavedShows: () => ({ isSaved: () => false, saveShow: vi.fn(), unsaveShow: vi.fn() }) }));
vi.mock('@/hooks/useSavedFilms', () => ({ useSavedFilms: () => ({ isFilmSaved: () => state.saved, saveFilm: state.save, unsaveFilm: state.unsave }) }));
vi.mock('@/hooks/useMinimizedChat', () => ({ useMinimizedChat: () => ({ minimize: vi.fn() }) }));
vi.mock('@/hooks/useMessages', () => ({
  useMessages: () => ({
    conversations: [{ user_id: 'sender', display_name: 'Sender', avatar_url: null, unread_count: 0 }],
    loadingConversations: false, useConversation: () => ({ data: [message], isLoading: false }),
    sendMessage: { mutateAsync: vi.fn() }, markAsRead: { mutate: vi.fn() },
  }),
}));
vi.mock('@/hooks/useGroupChats', () => ({
  useGroupChats: () => ({ groupChats: [], loadingGroupChats: false, useGroupMessages: () => ({ data: [message], isLoading: false }), sendGroupMessage: { mutateAsync: vi.fn() } }),
}));
vi.mock('@/components/stage-whisper/ShowDetailSheet', () => ({ ShowDetailSheet: () => null }));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({ default: () => null }));
vi.mock('@/components/opportunities/ApplicationDialog', () => ({ default: () => null }));
vi.mock('@/components/messages/NewGroupMessageDialog', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      state.from(table);
      const chain = {
        select: (fields: string) => { state.select(fields); return chain; },
        eq: (field: string, value: string) => { state.eq(field, value); return chain; },
        single: async () => ({ data: state.film, error: state.film ? null : new Error('not found') }),
      };
      return chain;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: () => {} });
});
afterAll(() => {
  vi.unstubAllGlobals();
  if (descriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', descriptor);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});
beforeEach(() => {
  state.film = { id: 'film-1', title: 'Film Detail', studio: 'Studio', weekend_gross: 1, total_gross: 2, week_change: 0, rating: 4, weeks_in_release: 1, poster_url: null, ticket_url: null, date: '2026-01-01' };
  state.saved = false; state.from.mockReset(); state.select.mockReset(); state.eq.mockReset(); state.save.mockReset(); state.unsave.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderThread = (kind: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={['/messages/direct/sender']}><QueryClientProvider client={client}>
    {kind === 'direct'
      ? <Routes><Route path="/messages/direct/:userId" element={<MessagesPage />} /></Routes>
      : <GroupChatThread groupChatId="group-1" groupName="Team" />}
  </QueryClientProvider></MemoryRouter>);
};

describe.each(['direct', 'group'])('%s shared film', (kind) => {
  it('renders present poster and ticket URLs', async () => {
    if (!state.film) throw new Error('Missing film fixture');
    state.film = { ...state.film, poster_url: 'https://example.test/poster.jpg', ticket_url: 'https://example.test/tickets' };
    renderThread(kind);
    fireEvent.click(await screen.findByRole('button', { name: /shared film/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'Film Detail' }).getAttribute('src')).toBe('https://example.test/poster.jpg');
    expect(within(dialog).getByRole('link', { name: /get tickets/i }).getAttribute('href')).toBe('https://example.test/tickets');
  });

  it.each([false, true])('opens real details with null-image and ticket fallbacks and saved=%s', async (saved) => {
    state.saved = saved;
    renderThread(kind);
    fireEvent.click(await screen.findByRole('button', { name: /shared film/i }));
    expect(await screen.findByRole('heading', { name: 'Film Detail' })).toBeTruthy();
    expect(state.from).toHaveBeenCalledWith('film_metrics');
    expect(state.select).toHaveBeenCalledWith('*');
    expect(state.eq).toHaveBeenCalledWith('id', 'film-1');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('img', { name: 'Film Detail' })).toBeNull();
    expect(within(dialog).getByRole('link', { name: /get tickets/i }).getAttribute('href'))
      .toBe('https://www.fandango.com/search?q=Film%20Detail');
    const heart = dialog.querySelector('svg.lucide-heart')?.closest('button');
    if (!heart) throw new Error('Missing film save button');
    fireEvent.click(heart);
    expect(saved ? state.unsave : state.save).toHaveBeenCalledWith('film-1');
  });

  it('does not open details when the film query returns no row', async () => {
    state.film = null;
    renderThread(kind);
    fireEvent.click(await screen.findByRole('button', { name: /shared film/i }));
    await waitFor(() => expect(state.eq).toHaveBeenCalledWith('id', 'film-1'));
    expect(screen.queryByRole('heading', { name: 'Film Detail' })).toBeNull();
  });
});
