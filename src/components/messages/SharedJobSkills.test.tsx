import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpportunityView } from '@/hooks/useOpportunities';
import GroupChatThread from './GroupChatThread';
import MessagesPage from '@/pages/MessagesPage';

const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), detail: vi.fn(),
}));
const message = {
  id: 'message-1', sender_id: 'sender', created_at: '2026-01-01T12:00:00Z',
  content: '__SHARED_ITEM__{"type":"Job","title":"Shared Job","url":"/opportunities?jobId=job-1"}__END__',
  sender: { display_name: 'Sender', avatar_url: null },
};
vi.mock('@/lib/featureFlags', () => ({ JOBS_ENABLED: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' }, loading: false }) }));
vi.mock('@/hooks/useSavedShows', () => ({ useSavedShows: () => ({ isSaved: () => false, saveShow: vi.fn(), unsaveShow: vi.fn() }) }));
vi.mock('@/hooks/useSavedFilms', () => ({ useSavedFilms: () => ({ isFilmSaved: () => false, saveFilm: vi.fn(), unsaveFilm: vi.fn() }) }));
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
vi.mock('@/components/stage-whisper/FilmDetailSheet', () => ({ FilmDetailSheet: () => null }));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({
  default: ({ opportunity, open }: { opportunity: OpportunityView | null; open: boolean }) => {
    state.detail(opportunity, open);
    return null;
  },
}));
vi.mock('@/components/opportunities/ApplicationDialog', () => ({ default: () => null }));
vi.mock('@/components/messages/NewGroupMessageDialog', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      state.from(table);
      const chain = {
        select: (fields: string) => { state.select(table, fields); return chain; },
        eq: (field: string, value: string) => { state.eq(table, field, value); return chain; },
        maybeSingle: async () => ({ data: table === 'opportunities' ? state.row : null, error: null }),
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
  state.row = {
    id: 'job-1', title: 'Synthetic Job', description: 'Synthetic description', type: 'job', status: 'open',
    posted_by: 'owner', company: null, location: null, is_remote: true, compensation: null,
    experience_level: 'any', roles: [], requirements: [], deadline: null, start_date: null,
    duration: null, tags: [], created_at: '2026-01-01T00:00:00Z', is_featured: false,
    action_type: 'apply', image_url: null, link_url: null, link_title: null,
  };
  state.from.mockReset(); state.select.mockReset(); state.eq.mockReset(); state.detail.mockReset();
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

describe.each(['direct', 'group'])('%s shared job skills', (kind) => {
  it.each([
    { label: 'string array', extra: { skills: ['  movement  ', '', 'voice'] }, expected: ['  movement  ', '', 'voice'] },
    { label: 'empty array', extra: { skills: [] }, expected: [] },
    { label: 'absent property', extra: {}, expected: [] },
    { label: 'null', extra: { skills: null }, expected: [] },
    { label: 'string', extra: { skills: 'movement' }, expected: [] },
    { label: 'mixed array', extra: { skills: ['movement', 1] }, expected: [] },
    { label: 'non-string array', extra: { skills: [1, 2] }, expected: [] },
    { label: 'object', extra: { skills: { name: 'movement' } }, expected: [] },
    { label: 'sparse array', extra: { skills: Array(2) }, expected: [] },
  ])('maps $label at the detail boundary', async ({ extra, expected }) => {
    state.row = { ...state.row, ...extra };
    renderThread(kind);
    fireEvent.click(await screen.findByRole('button', { name: /shared job/i }));
    await waitFor(() => expect(state.detail).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'job-1', skills: expected }), true,
    ));
    expect(state.from).toHaveBeenCalledWith('opportunities');
    expect(state.select).toHaveBeenCalledWith('opportunities', '*');
    expect(state.eq).toHaveBeenCalledWith('opportunities', 'id', 'job-1');
  });
});
