import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/components/auth/VisitorAuthPrompt', () => ({
  VisitorAuthPrompt: () => null,
}));

vi.mock('@/integrations/supabase/client', () => {
  const panelist = {
    id: 'panelist-1',
    event_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'user-1',
    display_name: 'Shy\'Peria Brown',
    title: 'Actor, Writer',
    headline: null,
    location: 'NYC',
    bio: 'Panelist bio',
    headshot_url: 'https://example.com/headshot.jpg',
    cover_url: null,
    website_url: null,
    instagram_url: null,
    reel_url: null,
    skills: [],
    badges: [],
    public_slug: 'shyperia-brown',
  };

  const event = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'HOT SEAT',
    description: 'Event description',
    event_date: '2026-08-31T18:00:00Z',
    event_type: 'Event',
    image_url: 'https://example.com/hot-seat.jpg',
    location: 'RSVP for location',
  };

  return {
    supabase: {
      from: (table: string) => {
        const chain: {
          select: ReturnType<typeof vi.fn>;
          eq: ReturnType<typeof vi.fn>;
          limit: ReturnType<typeof vi.fn>;
          maybeSingle: ReturnType<typeof vi.fn>;
        } = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          limit: vi.fn(async () => ({
            data: table === 'event_panelists' ? [panelist] : [],
            error: null,
          })),
          maybeSingle: vi.fn(async () => ({
            data: table === 'events' ? event : null,
            error: null,
          })),
        };
        return chain;
      },
    },
  };
});

const renderPanelistPage = (PublicEventPanelistPage: React.ComponentType) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/events/11111111-1111-1111-1111-111111111111/panelists/shyperia-brown']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/events/:eventId/panelists/:panelistSlug"
            element={<PublicEventPanelistPage />}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('PublicEventPanelistPage', () => {
  it('does not use the event image as the panelist cover fallback', async () => {
    const PublicEventPanelistPage = (await import('@/pages/PublicEventPanelistPage')).default;

    renderPanelistPage(PublicEventPanelistPage);

    expect(await screen.findByRole('heading', { name: 'Shy\'Peria Brown' })).toBeInTheDocument();
    expect(screen.queryByAltText('HOT SEAT cover image')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'HOT SEAT cover image' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Shy\'Peria Brown cover image')).not.toBeInTheDocument();
  });
});
