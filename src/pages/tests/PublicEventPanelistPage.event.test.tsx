import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicEventPanelistPage from '../PublicEventPanelistPage';

const state = vi.hoisted(() => ({
  event: null as null | { id: string; title: string | null; description: string | null; event_date: string | null; event_type: string | null; image_url: string | null; location: string | null },
  from: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/components/auth/VisitorAuthPrompt', () => ({ VisitorAuthPrompt: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      state.from(table);
      const chain = {
        select: () => chain, eq: () => chain,
        limit: async () => ({ data: [{
          id: 'panelist-1', event_id: '11111111-1111-1111-1111-111111111111', user_id: null,
          display_name: 'Panelist', title: null, headline: 'Headline', location: null,
          bio: null, headshot_url: null, cover_url: null, website_url: null,
          instagram_url: null, reel_url: null, skills: [], badges: [], public_slug: 'panelist',
        }], error: null }),
        maybeSingle: async () => ({ data: table === 'events_public_browse' ? state.event : null, error: null }),
      };
      return chain;
    },
  },
}));

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter initialEntries={['/events/11111111-1111-1111-1111-111111111111/panelists/panelist']}>
    <QueryClientProvider client={client}><Routes>
      <Route path="/events/:eventId/panelists/:panelistSlug" element={<PublicEventPanelistPage />} />
    </Routes></QueryClientProvider>
  </MemoryRouter>);
};
beforeEach(() => {
  state.from.mockReset();
  state.event = { id: '11111111-1111-1111-1111-111111111111', title: 'Event Title', description: 'Event description', event_date: '2026-08-31T18:00:00Z', event_type: 'Panel', image_url: null, location: 'Event Venue' };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('public panelist event', () => {
  it('renders the public event and links to it', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Panelist' })).toBeTruthy();
    expect(screen.getByText('Event description')).toBeTruthy();
    expect(screen.getAllByText('Event Venue').length).toBeGreaterThan(0);
    expect(screen.getByText('Panel')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open event/i }).getAttribute('href')).toBe('/events/event-title-11111111');
    expect(state.from).toHaveBeenCalledWith('events_public_browse');
  });

  it('uses the feed link when the event is missing', async () => {
    state.event = null;
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Panelist' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Event' }).getAttribute('href')).toBe('/feed?tab=events');
    expect(screen.queryByRole('link', { name: /open event/i })).toBeNull();
  });

  it('retains null-field fallbacks without inventing event content', async () => {
    state.event = { id: '11111111-1111-1111-1111-111111111111', title: null, description: null, event_date: null, event_type: null, image_url: null, location: null };
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Panelist' })).toBeTruthy();
    expect(screen.getByText('Headline')).toBeTruthy();
    expect(screen.queryByText('Event description')).toBeNull();
    expect(screen.queryByText('Event Venue')).toBeNull();
    expect(screen.queryByText('Panel')).toBeNull();
    expect(screen.getByRole('link', { name: /open event/i }).getAttribute('href')).toBe('/events/untitled-11111111');
  });
});
