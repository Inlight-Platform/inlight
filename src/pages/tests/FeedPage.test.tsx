// NOTE: This is a focused, minimal test outline for FeedPage behavior. Adjust selects/rpc calls to match your implementation.
import { beforeEach, describe, it, vi, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const { mockMyGroups } = vi.hoisted(() => ({
  mockMyGroups: [] as { id: string; slug: string; name: string; is_faculty: boolean }[],
}));

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
  useMyGroups: () => ({ data: mockMyGroups, isLoading: false }),
}));

interface MockFeedItem {
  content?: string;
  title?: string;
}

vi.mock('@/components/feed/FeedBentoCard', () => ({
  FeedBentoCard: ({ item }: { item: MockFeedItem }) => (
    <article data-testid="bento-card">{item.content || item.title}</article>
  ),
  getBentoSize: () => 'medium',
}));

vi.mock('@/components/feed/FeedItem', () => ({
  FeedItem: ({ item }: { item: MockFeedItem }) => (
    <article data-testid="list-card">{item.content || item.title}</article>
  ),
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
  const groupPostLinks = [
    {
      post_id: 'gp1',
      posts: {
        id: 'gp1',
        content: 'Private Group Post',
        user_id: 'u1',
        visibility: 'group',
        created_at: '2026-01-03T00:00:00Z',
      },
    },
  ];
  const profiles = [{ user_id: 'u1', display_name: 'Alice', avatar_url: null }];

  const resultFor = (table: string) => {
    if (table === 'posts') return posts;
    if (table === 'post_groups') return groupPostLinks;
    if (table === 'project_groups') return [];
    if (table === 'profiles_public') return profiles;
    return [];
  };

  return {
    supabase: {
      from: (table: string) => {
        const chain: {
          select: ReturnType<typeof vi.fn>;
          not: ReturnType<typeof vi.fn>;
          order: ReturnType<typeof vi.fn>;
          limit: ReturnType<typeof vi.fn>;
          in: ReturnType<typeof vi.fn>;
          eq: ReturnType<typeof vi.fn>;
          maybeSingle: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        } = {
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

const renderFeed = (ui: React.ReactElement, initialEntries = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe('FeedPage (filtered posts)', () => {
  beforeEach(() => {
    mockMyGroups.length = 0;
  });

  it('shows posts with visible creator profiles and filters out orphan posts', async () => {
    // Lazy: import FeedPage to exercise rendering
    const FeedPage = (await import('@/pages/FeedPage')).default;
    renderFeed(FeedPage ? <FeedPage /> : null);

    // Behavior depends on implementation; this is an example expectation
    // Ensure 'Visible Post' is rendered and 'Orphan Post' is not
    expect(await screen.findByText('Visible Post')).toBeDefined();
    expect(screen.queryByText('Orphan Post')).toBeNull();
  });

  it('renders a private tab for each accessible group', async () => {
    mockMyGroups.push(
      { id: 'group-1', slug: 'film', name: 'Film Dept', is_faculty: false },
      { id: 'group-2', slug: 'acting', name: 'Acting Lab', is_faculty: true }
    );

    const FeedPage = (await import('@/pages/FeedPage')).default;
    renderFeed(FeedPage ? <FeedPage /> : null);

    expect(await screen.findByRole('button', { name: /Film Dept/i })).toBeDefined();
    expect(await screen.findByRole('button', { name: /Acting Lab/i })).toBeDefined();
  });

  it('falls back to the normal feed when a no-group user has a stale group tab URL', async () => {
    const FeedPage = (await import('@/pages/FeedPage')).default;
    renderFeed(FeedPage ? <FeedPage /> : null, ['/?tab=group%3Astale-group']);

    expect(await screen.findByText('Visible Post')).toBeDefined();
    expect(screen.queryByText('You do not have access to this private group feed.')).toBeNull();
  });

  it('uses the grid renderer for group feed items when grid view is selected', async () => {
    mockMyGroups.push({ id: 'group-1', slug: 'film', name: 'Film Dept', is_faculty: false });

    const FeedPage = (await import('@/pages/FeedPage')).default;
    renderFeed(FeedPage ? <FeedPage /> : null, ['/?tab=group%3Agroup-1']);

    expect(await screen.findByText('Private Group Post')).toBeDefined();
    expect(screen.getByTestId('bento-card')).toBeDefined();
    expect(screen.queryByTestId('list-card')).toBeNull();
  });
});
