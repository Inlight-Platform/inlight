import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPosts } from './UserPosts';

const state = vi.hoisted(() => ({
  user: new Map<string, { id: string }>(),
  errors: new Map<string, Error>(),
  rpc: vi.fn(), calls: vi.fn(), item: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user.get('viewer') || null }) }));
vi.mock('@/components/feed/FeedItem', () => ({
  FeedItem: ({ item }: { item: { id: string; type: string; user_id: string; content?: string; title?: string } }) => {
    state.item(item);
    return <article>{item.title || item.content}</article>;
  },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: (table: string) => {
      state.calls(table, 'from');
      const result = { data: [], error: null };
      const chain = {
        select: (fields: string) => { state.calls(table, 'select', fields); return chain; },
        eq: (field: string, value: unknown) => { state.calls(table, 'eq', field, value); return chain; },
        order: (field: string, options: unknown) => { state.calls(table, 'order', field, options); return chain; },
        in: (field: string, value: unknown) => { state.calls(table, 'in', field, value); return chain; },
        is: (field: string, value: unknown) => { state.calls(table, 'is', field, value); return chain; },
        single: async () => ({ data: { display_name: 'Synthetic Person', avatar_url: null }, error: null }),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  },
}));
const renderPosts = (userId: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><UserPosts userId={userId} /></QueryClientProvider>);
  return { client, view };
};
const waitQuery = async (client: QueryClient, userId: string, viewer: string, status: 'success' | 'error') => {
  await waitFor(() => expect(client.getQueryState(['user-posts', userId, viewer])?.status).toBe(status));
};
beforeEach(() => {
  state.user.clear(); state.errors.clear(); state.rpc.mockReset(); state.calls.mockReset(); state.item.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    const error = state.errors.get(name) || null;
    if (error) return { data: null, error };
    if (name === 'get_public_profile_posts') return { data: [{ id: 'post-1', content: 'Synthetic update', link_url: null, created_at: '2026-01-01T00:00:00Z' }], error: null };
    if (name === 'get_public_profile_events') return { data: [{ id: 'event-1', title: 'Synthetic Event', description: null, image_url: null, image_urls: null, event_date: '2026-01-03T00:00:00Z', created_at: '2026-01-02T00:00:00Z' }], error: null };
    throw new Error('Unexpected RPC: ' + name);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('UserPosts public activity RPCs', () => {
  it('loads visitor posts and events without private or profile queries', async () => {
    const { client } = renderPosts('profile-1');
    await waitQuery(client, 'profile-1', 'visitor', 'success');
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_posts', { _user_id: 'profile-1' });
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_events', { _user_id: 'profile-1' });
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'post-1', type: 'post', user_id: '', content: 'Synthetic update' }));
    expect(state.item).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1', type: 'event', user_id: '', title: 'Synthetic Event' }));
    expect(await screen.findByText('Synthetic update')).toBeTruthy();
    expect(await screen.findByText('Synthetic Event')).toBeTruthy();
    expect(state.calls).not.toHaveBeenCalled();
  });

  it('stops before the event RPC when the public post RPC fails', async () => {
    state.errors.set('get_public_profile_posts', new Error('posts failed'));
    const { client } = renderPosts('profile-1');
    await waitQuery(client, 'profile-1', 'visitor', 'error');
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_posts', { _user_id: 'profile-1' });
    expect(state.rpc).not.toHaveBeenCalledWith('get_public_profile_events', expect.anything());
  });

  it('reports query error when the public event RPC fails', async () => {
    state.errors.set('get_public_profile_events', new Error('events failed'));
    const { client } = renderPosts('profile-1');
    await waitQuery(client, 'profile-1', 'visitor', 'error');
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_posts', { _user_id: 'profile-1' });
    expect(state.rpc).toHaveBeenCalledWith('get_public_profile_events', { _user_id: 'profile-1' });
  });

  it('preserves signed-in private queries for own and other profiles', async () => {
    state.user.set('viewer', { id: 'profile-1' });
    const own = renderPosts('profile-1');
    await waitQuery(own.client, 'profile-1', 'authenticated', 'success');
    expect(state.calls).toHaveBeenCalledWith('posts', 'eq', 'user_id', 'profile-1');
    expect(state.calls).toHaveBeenCalledWith('posts', 'order', 'created_at', { ascending: false });
    expect(state.calls).toHaveBeenCalledWith('events', 'eq', 'user_id', 'profile-1');
    expect(state.calls).toHaveBeenCalledWith('events', 'order', 'created_at', { ascending: false });
    expect(state.calls).not.toHaveBeenCalledWith('events', 'in', 'visibility', expect.anything());
    expect(state.calls).toHaveBeenCalledWith('profiles_public', 'eq', 'user_id', 'profile-1');
    expect(state.rpc).not.toHaveBeenCalled();
    own.view.unmount(); state.calls.mockClear(); state.rpc.mockClear();
    const other = renderPosts('profile-2');
    await waitQuery(other.client, 'profile-2', 'authenticated', 'success');
    expect(state.calls).toHaveBeenCalledWith('posts', 'eq', 'user_id', 'profile-2');
    expect(state.calls).toHaveBeenCalledWith('posts', 'order', 'created_at', { ascending: false });
    expect(state.calls).toHaveBeenCalledWith('events', 'eq', 'user_id', 'profile-2');
    expect(state.calls).toHaveBeenCalledWith('events', 'order', 'created_at', { ascending: false });
    expect(state.calls).toHaveBeenCalledWith('events', 'in', 'visibility', ['public', 'network', 'specific']);
    expect(state.calls).toHaveBeenCalledWith('profiles_public', 'eq', 'user_id', 'profile-2');
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
