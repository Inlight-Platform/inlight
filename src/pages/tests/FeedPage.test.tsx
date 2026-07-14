// NOTE: This is a focused, minimal test outline for FeedPage behavior. Adjust selects/rpc calls to match your implementation.
import { describe, it, vi, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'viewer' }, loading: false }),
}));

vi.mock('@/hooks/useNetworkConnections', () => ({
  useNetworkConnections: () => ({
    firstDegree: [],
    secondDegree: [],
    getConnectionDegree: () => null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useGroups', () => ({
  useMyGroups: () => ({ data: [] }),
}));

vi.mock('@/components/feed/FeedBentoCard', () => ({
  FeedBentoCard: ({ item }: any) => <article>{item.content || item.title}</article>,
  getBentoSize: () => 'medium',
}));

vi.mock('@/components/feed/FeedItem', () => ({
  FeedItem: ({ item }: any) => <article>{item.content || item.title}</article>,
}));

vi.mock('@/components/feed/WelcomeMessage', () => ({
  WelcomeMessage: () => null,
}));

vi.mock('@/components/feed/PostCreator', () => ({
  PostCreator: () => null,
}));

vi.mock('@/components/feed/YouTab', () => ({
  YouTab: () => null,
}));

vi.mock('@/components/feed/ServicesTab', () => ({
  ServicesTab: () => null,
}));

vi.mock('@/components/feed/FeedSurvey', () => ({
  FeedSurvey: () => null,
}));

vi.mock('@/integrations/supabase/client', () => {
  const posts = [
    { id: 'p1', content: 'Visible Post', user_id: 'u1', visibility: 'public', created_at: '2026-01-02T00:00:00Z' },
    { id: 'p2', content: 'Orphan Post', user_id: 'missing', visibility: 'public', created_at: '2026-01-01T00:00:00Z' },
  ];
  const profiles = [{ user_id: 'u1', display_name: 'Alice', avatar_url: null }];

  const resultFor = (table: string) => {
    if (table === 'posts') return posts;
    if (table === 'profiles_public') return profiles;
    return [];
  };

  return {
    supabase: {
      from: (table: string) => {
        const chain: any = {
          select: vi.fn(() => chain),
          not: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(async () => ({ data: resultFor(table), error: null })),
          in: vi.fn(async () => ({ data: resultFor(table), error: null })),
          eq: vi.fn(async () => ({ data: resultFor(table), error: null })),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          update: vi.fn(() => chain),
        };
        return chain;
      },
      rpc: vi.fn(async () => ({ data: null, error: null })),
    },
  };
});

const renderFeed = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe('FeedPage (filtered posts)', () => {
  it('shows posts with visible creator profiles and filters out orphan posts', async () => {
    // Lazy: import FeedPage to exercise rendering
    const FeedPage = (await import('@/pages/FeedPage')).default;
    renderFeed(FeedPage ? <FeedPage /> : null);

    // Behavior depends on implementation; this is an example expectation
    // Ensure 'Visible Post' is rendered and 'Orphan Post' is not
    expect(await screen.findByText('Visible Post')).toBeDefined();
    expect(screen.queryByText('Orphan Post')).toBeNull();
  });
});
