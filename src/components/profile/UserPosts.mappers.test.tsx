import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPosts } from './UserPosts';

const state = vi.hoisted(() => ({
  user: new Map<string, { id: string }>(),
  rows: new Map<string, Array<Record<string, unknown>>>(),
  rpc: vi.fn(), item: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user.get('viewer') || null }) }));
vi.mock('@/components/feed/FeedItem', () => ({
  FeedItem: ({ item }: { item: { id: string; title?: string; content?: string } }) => {
    state.item(item);
    return <article>{item.title || item.content}</article>;
  },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
      const result = () => ({ data: state.rows.get(table) || [], error: null });
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain, in: () => chain, is: () => chain,
        single: async () => ({ data: { display_name: 'Synthetic Person', avatar_url: null }, error: null }),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  },
}));
const post = () => ({ id: 'post-1', content: 'Synthetic update', link_url: null, created_at: '2026-01-01T00:00:00Z', image_positions: null });
const event = () => ({ id: 'event-1', title: 'Synthetic Event', description: 'Synthetic description', image_url: null, image_urls: null, image_positions: null, event_date: '2026-02-01T00:00:00Z', created_at: '2026-01-02T00:00:00Z' });
const renderPosts = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><UserPosts userId="profile-1" /></QueryClientProvider>);
  return client;
};
const settled = async (client: QueryClient, viewer = 'visitor') => {
  await waitFor(() => expect(client.getQueryState(['user-posts', 'profile-1', viewer])?.status).toBe('success'));
};
beforeEach(() => {
  state.user.clear(); state.rows.clear(); state.item.mockReset(); state.rpc.mockReset();
  state.rows.set('get_public_profile_posts', [post()]); state.rows.set('get_public_profile_events', [event()]);
  state.rpc.mockImplementation(async (name: string) => ({ data: state.rows.get(name) || [], error: null }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('UserPosts activity mappers', () => {
  it('maps visitor activity in creation-time order', async () => {
    const client = renderPosts(); await settled(client);
    expect(client.getQueryData(['user-posts', 'profile-1', 'visitor'])).toEqual([
      expect.objectContaining({ id: 'event-1', title: 'Synthetic Event', event_date: '2026-02-01T00:00:00Z' }),
      expect.objectContaining({ id: 'post-1', content: 'Synthetic update' }),
    ]);
  });
  it.each([
    { source: 'get_public_profile_posts', field: 'content', hidden: 'post-1', retained: 'event-1' },
    { source: 'get_public_profile_posts', field: 'created_at', hidden: 'post-1', retained: 'event-1' },
    { source: 'get_public_profile_events', field: 'title', hidden: 'event-1', retained: 'post-1' },
    { source: 'get_public_profile_events', field: 'event_date', hidden: 'event-1', retained: 'post-1' },
    { source: 'get_public_profile_events', field: 'created_at', hidden: 'event-1', retained: 'post-1' },
  ])('hides a public row with null $field from $source', async ({ source, field, hidden, retained }) => {
    const row: Record<string, unknown> = source === 'get_public_profile_posts' ? post() : event();
    row[field] = null; state.rows.set(source, [row]);
    const client = renderPosts(); await settled(client);
    expect(client.getQueryData(['user-posts', 'profile-1', 'visitor'])).toEqual([expect.objectContaining({ id: retained })]);
    expect(state.item).not.toHaveBeenCalledWith(expect.objectContaining({ id: hidden }));
  });
  it('keeps visitor attribution omitted', async () => {
    const client = renderPosts(); await settled(client);
    await screen.findByText('Synthetic Event');
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1', user_id: '', creator_profile: undefined }));
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', user_id: '', creator_profile: undefined }));
  });
  it('keeps signed-in identities and profile attribution', async () => {
    state.user.set('viewer', { id: 'profile-1' });
    state.rows.set('posts', [{ ...post(), user_id: 'profile-1' }]);
    state.rows.set('events', [{ ...event(), user_id: 'profile-1' }]);
    const client = renderPosts(); await settled(client, 'authenticated');
    await screen.findByText('Synthetic Event');
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1', user_id: 'profile-1', creator_profile: expect.objectContaining({ display_name: 'Synthetic Person' }) }));
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', user_id: 'profile-1', creator_profile: expect.objectContaining({ display_name: 'Synthetic Person' }) }));
  });
  it('normalizes non-array visitor image positions', async () => {
    state.rows.set('get_public_profile_posts', [{ ...post(), image_positions: { x: 20 } }]);
    state.rows.set('get_public_profile_events', [{ ...event(), image_positions: 'invalid' }]);
    const client = renderPosts(); await settled(client); await screen.findByText('Synthetic Event');
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', image_positions: null }));
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1', image_positions: null }));
  });
  it('normalizes mixed signed-in image positions', async () => {
    state.user.set('viewer', { id: 'profile-1' });
    const positions = ['bad', { x: 'bad', y: 25, zoom: 2 }];
    state.rows.set('posts', [{ ...post(), user_id: 'profile-1', image_positions: positions }]);
    state.rows.set('events', [{ ...event(), user_id: 'profile-1', image_positions: positions }]);
    const client = renderPosts(); await settled(client, 'authenticated'); await screen.findByText('Synthetic Event');
    for (const id of ['post-1', 'event-1']) expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id, image_positions: [{}, { x: null, y: 25, zoom: 2 }] }));
  });
  it('retains the event single-image fallback', async () => {
    state.rows.set('get_public_profile_events', [{ ...event(), image_url: 'https://example.test/image.jpg', image_urls: null }]);
    const client = renderPosts(); await settled(client); await screen.findByText('Synthetic Event');
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1', image_urls: ['https://example.test/image.jpg'] }));
  });
  it('continues to omit event payment fields', async () => {
    state.rows.set('get_public_profile_events', [{ ...event(), is_paid: true, price: 25, currency: 'usd', stripe_price_id: 'synthetic', payment_link_url: 'https://example.test/pay' }]);
    const client = renderPosts(); await settled(client); await screen.findByText('Synthetic Event');
    const eventCall = state.item.mock.calls.find(([item]) => item.id === 'event-1');
    if (!eventCall) throw new Error('Missing mapped event');
    for (const field of ['is_paid', 'price', 'currency', 'stripe_price_id', 'payment_link_url']) {
      expect(eventCall[0]).not.toHaveProperty(field);
    }
  });
});
