import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedItemData } from '@/components/feed/FeedItem';
import FeedPage from '../FeedPage';

const state = vi.hoisted(() => ({
  user: new Map<string, { id: string }>(),
  lists: new Map<string, Array<Record<string, unknown>>>(),
  errors: new Map<string, Error>(),
  calls: vi.fn(), rpc: vi.fn(), card: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user.get('viewer') || null, loading: false }) }));
vi.mock('@/hooks/useNetworkConnections', () => ({ useNetworkConnections: () => ({ firstDegree: [], secondDegree: [], getConnectionDegree: () => null, isLoading: false }) }));
vi.mock('@/hooks/useGroups', () => ({ useMyGroups: () => ({ data: [], isLoading: false }) }));
vi.mock('@/components/feed/FeedBentoCard', () => ({
  FeedBentoCardWithComments: ({ item }: { item: FeedItemData }) => { state.card(item); return <article>{item.content || item.title}</article>; },
  getBentoSize: () => 'medium',
}));
vi.mock('@/components/feed/FeedItem', () => ({ FeedItem: () => null }));
vi.mock('@/components/feed/WelcomeMessage', () => ({ WelcomeMessage: () => null }));
vi.mock('@/components/feed/PostCreator', () => ({ PostCreator: () => null }));
vi.mock('@/components/feed/YouTab', () => ({ YouTab: () => null }));
vi.mock('@/components/feed/ServicesTab', () => ({ ServicesTab: () => null }));
vi.mock('@/components/feed/FeedSurvey', () => ({ FeedSurvey: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const record = (operation: string, ...args: unknown[]) => state.calls(table, operation, ...args);
      const list = () => ({ data: state.errors.has(table) ? null : state.lists.get(table) || [], error: state.errors.get(table) || null });
      const chain = {
        select: (fields: string) => { record('select', fields); return chain; },
        not: (field: string, op: string, value: unknown) => { record('not', field, op, value); return chain; },
        neq: (field: string, value: unknown) => { record('neq', field, value); return chain; },
        order: (field: string, options: unknown) => { record('order', field, options); return chain; },
        eq: (field: string, value: unknown) => { record('eq', field, value); return chain; },
        or: (filter: string) => { record('or', filter); return chain; },
        in: (field: string, value: unknown) => { record('in', field, value); return chain; },
        limit: async (value: number) => { record('limit', value); return list(); },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: ReturnType<typeof list>) => unknown) => Promise.resolve(list()).then(resolve),
      };
      return chain;
    },
    rpc: state.rpc,
  },
}));

const post = () => ({
  id: 'post-1', content: 'Synthetic public post', image_url: null, image_urls: null,
  image_position_x: null, image_position_y: null, image_zoom: null, image_positions: null,
  link_url: null, link_title: null, visibility: 'public',
  created_at: '2026-01-01T00:00:00Z', updated_at: null,
});
const renderFeed = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><FeedPage /></QueryClientProvider></MemoryRouter>);
  return client;
};
const waitPosts = async (client: QueryClient, status: 'success' | 'error', viewer = 'visitor') => {
  await waitFor(() => expect(client.getQueryState(['feed-posts', viewer])?.status).toBe(status), { timeout: 5000 });
};
beforeEach(() => {
  state.user.clear(); state.lists.clear(); state.errors.clear();
  state.calls.mockReset(); state.rpc.mockReset(); state.card.mockReset();
  state.rpc.mockImplementation(async (name: string) => ({
    data: name === 'get_public_profiles' ? [{ user_id: 'author-1', display_name: 'Synthetic Author', avatar_url: null }]
      : name === 'get_public_group_authors' ? [{ id: 'group-1', name: 'Synthetic Department' }] : [],
    error: null,
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('public feed posts', () => {
  it('loads a visitor post with the public query and omitted attribution', async () => {
    state.lists.set('posts_public_browse', [post()]);
    const client = renderFeed(); await waitPosts(client, 'success');
    expect(await screen.findByText('Synthetic public post')).toBeTruthy();
    expect(client.getQueryData(['feed-posts', 'visitor'])).toEqual([expect.objectContaining({ user_id: '', creator_profile: undefined })]);
    expect(state.card).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', user_id: '', creator_profile: undefined }));
    expect(state.calls).toHaveBeenCalledWith('posts_public_browse', 'select', '*');
    expect(state.calls).toHaveBeenCalledWith('posts_public_browse', 'not', 'content', 'like', '🎯%');
    expect(state.calls).toHaveBeenCalledWith('posts_public_browse', 'neq', 'visibility', 'group');
    expect(state.calls).toHaveBeenCalledWith('posts_public_browse', 'order', 'created_at', { ascending: false });
    expect(state.calls).toHaveBeenCalledWith('posts_public_browse', 'limit', 100);
    expect(state.rpc).not.toHaveBeenCalledWith('get_public_profiles', expect.anything());
  });

  it('defaults a null visitor image zoom to one', async () => {
    state.lists.set('posts_public_browse', [post()]);
    const client = renderFeed(); await waitPosts(client, 'success');
    await waitFor(() => expect(state.card).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', image_zoom: 1 })));
  });

  it('passes numeric visitor image positions to the card', async () => {
    state.lists.set('posts_public_browse', [{ ...post(), image_positions: [{ x: 20, y: 70, zoom: 2 }] }]);
    const client = renderFeed(); await waitPosts(client, 'success');
    await waitFor(() => expect(state.card).toHaveBeenCalledWith(expect.objectContaining({ image_positions: [{ x: 20, y: 70, zoom: 2 }] })));
  });

  it('normalizes non-array visitor image positions to null', async () => {
    state.lists.set('posts_public_browse', [{ ...post(), image_positions: { x: 20 } }]);
    const client = renderFeed(); await waitPosts(client, 'success');
    await waitFor(() => expect(state.card).toHaveBeenCalledWith(expect.objectContaining({ image_positions: null })));
  });

  it('hides a visitor row with null creation time', async () => {
    state.lists.set('posts_public_browse', [{ ...post(), id: 'invalid', content: 'Hidden post', created_at: null }, post()]);
    const client = renderFeed(); await waitPosts(client, 'success');
    expect(await screen.findByText('Synthetic public post')).toBeTruthy();
    expect(screen.queryByText('Hidden post')).toBeNull();
    expect(client.getQueryData(['feed-posts', 'visitor'])).toEqual([expect.objectContaining({ id: 'post-1' })]);
  });

  it('guards against a synthetic returned null-content row', async () => {
    state.lists.set('posts_public_browse', [{ ...post(), id: 'invalid', content: null }, post()]);
    const client = renderFeed(); await waitPosts(client, 'success');
    expect(client.getQueryData(['feed-posts', 'visitor'])).toEqual([expect.objectContaining({ id: 'post-1' })]);
    expect(await screen.findByText('Synthetic public post')).toBeTruthy();
  });

  it('preserves private personal and group author enrichment', async () => {
    state.user.set('viewer', { id: 'viewer' });
    state.lists.set('posts', [
      { ...post(), id: 'personal', content: 'Personal post', user_id: 'author-1', author_identity: 'personal', author_group_id: null },
      { ...post(), id: 'group', content: 'Group post', user_id: 'author-1', author_identity: 'group', author_group_id: 'group-1' },
    ]);
    const client = renderFeed(); await waitPosts(client, 'success', 'authenticated');
    expect(await screen.findByText('Personal post')).toBeTruthy();
    expect(await screen.findByText('Group post')).toBeTruthy();
    expect(state.calls).toHaveBeenCalledWith('posts', 'select', '*');
    expect(state.rpc).toHaveBeenCalledWith('get_public_profiles', { _user_ids: ['author-1'] });
    expect(state.rpc).toHaveBeenCalledWith('get_public_group_authors', { _group_ids: ['group-1'] });
    expect(client.getQueryData(['feed-posts', 'authenticated'])).toEqual([
      expect.objectContaining({ id: 'personal', creator_profile: expect.objectContaining({ display_name: 'Synthetic Author' }) }),
      expect.objectContaining({ id: 'group', creator_profile: expect.objectContaining({ display_name: 'Synthetic Department' }) }),
    ]);
  });

  it('normalizes malformed signed-in image positions', async () => {
    state.user.set('viewer', { id: 'viewer' });
    state.lists.set('posts', [{ ...post(), user_id: 'viewer', author_identity: 'personal', author_group_id: null, image_positions: ['bad', { x: 'bad', y: 25, zoom: 2 }] }]);
    const client = renderFeed(); await waitPosts(client, 'success', 'authenticated');
    await waitFor(() => expect(state.card).toHaveBeenCalledWith(expect.objectContaining({ image_positions: [{}, { x: null, y: 25, zoom: 2 }] })));
  });

  it('exposes a returned post-query error in the query state', async () => {
    state.errors.set('posts_public_browse', new Error('posts failed'));
    const client = renderFeed(); await waitPosts(client, 'error');
  });
});
