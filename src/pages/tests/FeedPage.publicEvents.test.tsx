import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import FeedPage from '../FeedPage';

const state = vi.hoisted(() => ({
  user: new Map<string, { id: string; email: string }>(),
  lists: new Map<string, Array<Record<string, unknown>>>(),
  singles: new Map<string, Record<string, unknown>>(),
  errors: new Map<string, Error>(),
  calls: vi.fn(), rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user.get('viewer') || null, loading: false }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useFeatureAccess', () => ({ useFeatureAccess: () => ({ canManageEvents: false, canManageJobs: false, canManageProjects: false }) }));
vi.mock('@/hooks/useNetworkConnections', () => ({ useNetworkConnections: () => ({ firstDegree: [], secondDegree: [], getConnectionDegree: () => null, isLoading: false }) }));
vi.mock('@/hooks/useGroups', () => ({ useMyGroups: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useEventRsvps', () => ({ useEventRsvps: () => ({ rsvps: [], goingRsvps: [], goingCount: 0, submitRsvp: { mutate: vi.fn() } }) }));
vi.mock('@/hooks/usePostComments', () => ({ usePostCommentCount: () => ({ data: 0 }) }));
vi.mock('@/components/feed/WelcomeMessage', () => ({ WelcomeMessage: () => null }));
vi.mock('@/components/feed/PostCreator', () => ({ PostCreator: () => null }));
vi.mock('@/components/feed/YouTab', () => ({ YouTab: () => null }));
vi.mock('@/components/feed/ServicesTab', () => ({ ServicesTab: () => null }));
vi.mock('@/components/feed/FeedSurvey', () => ({ FeedSurvey: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const record = (operation: string, ...args: unknown[]) => state.calls(table, operation, ...args);
      const list = () => ({ data: state.errors.has(table + ':list') ? null : state.lists.get(table) || [], error: state.errors.get(table + ':list') || null });
      const chain = {
        select: (fields: string) => { record('select', fields); return chain; },
        neq: (field: string, value: unknown) => { record('neq', field, value); return chain; },
        not: (field: string, op: string, value: unknown) => { record('not', field, op, value); return chain; },
        order: (field: string, options: unknown) => { record('order', field, options); return chain; },
        eq: (field: string, value: unknown) => { record('eq', field, value); return chain; },
        or: (filter: string) => { record('or', filter); return chain; },
        in: (field: string, value: unknown) => { record('in', field, value); return chain; },
        is: (field: string, value: unknown) => { record('is', field, value); return chain; },
        limit: async (value: number) => { record('limit', value); return list(); },
        maybeSingle: async () => ({ data: state.singles.get(table) || null, error: state.errors.get(table + ':single') || null }),
        single: async () => ({ data: state.singles.get(table) || null, error: null }),
        then: (resolve: (value: ReturnType<typeof list>) => unknown) => Promise.resolve(list()).then(resolve),
      };
      return chain;
    },
    rpc: state.rpc,
  },
}));

const event = () => ({
  id: '11111111-1111-4111-8111-111111111111', slug: 'synthetic-event', title: 'Synthetic Event',
  description: null, event_date: '2099-05-01T12:00:00Z', event_type: null,
  image_url: null, image_urls: null, image_position_x: null, image_position_y: null,
  image_zoom: null, image_positions: null, link_url: null, link_title: null,
  location: null, is_paid: false, price: null, currency: null, stripe_price_id: null,
  payment_link_url: null, custom_question: null, visibility: 'public',
  created_at: '2026-01-01T00:00:00Z', updated_at: null,
});
const renderPage = (path = '/') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}>
    <Routes><Route path="/" element={<FeedPage />} /><Route path="/events/:eventId" element={<FeedPage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  return client;
};
const waitList = async (client: QueryClient, status: 'success' | 'error', viewer = 'visitor') => {
  await waitFor(() => expect(client.getQueryState(['feed-events', viewer])?.status).toBe(status), { timeout: 5000 });
};
const waitRoute = async (client: QueryClient, status: 'success' | 'error', viewer = 'visitor') => {
  await waitFor(() => expect(client.getQueryState(['feed-route-event', 'synthetic-event', viewer])?.status).toBe(status));
};
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
  state.user.clear(); state.lists.clear(); state.singles.clear(); state.errors.clear(); state.calls.mockReset(); state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_public_profiles' ? [{ user_id: 'author-1', display_name: 'Synthetic Author', avatar_url: null }] : [], error: null }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('public feed events', () => {
  it('loads a valid visitor row with the public query and omitted attribution', async () => {
    state.lists.set('events_public_browse', [event()]);
    const client = renderPage();
    await waitList(client, 'success');
    expect(await screen.findByText('Synthetic Event')).toBeTruthy();
    expect(client.getQueryData(['feed-events', 'visitor'])).toEqual([expect.objectContaining({ user_id: '', author_identity: undefined, author_group_id: undefined, creator_profile: undefined })]);
    expect(state.calls).toHaveBeenCalledWith('events_public_browse', 'select', '*');
    expect(state.calls).toHaveBeenCalledWith('events_public_browse', 'neq', 'visibility', 'group');
    expect(state.calls).toHaveBeenCalledWith('events_public_browse', 'order', 'event_date', { ascending: true });
    expect(state.calls).toHaveBeenCalledWith('events_public_browse', 'eq', 'visibility', 'public');
    expect(state.calls).toHaveBeenCalledWith('events_public_browse', 'limit', 100);
    expect(state.rpc).not.toHaveBeenCalledWith('get_public_profiles', expect.anything());
  });

  it.each([
    { label: 'null title', field: 'title', value: null },
    { label: 'null date', field: 'event_date', value: null },
    { label: 'null creation', field: 'created_at', value: null },
    { label: 'null payment status', field: 'is_paid', value: null },
    { label: 'paid null currency', field: 'currency', value: null },
    { label: 'paid empty currency', field: 'currency', value: '' },
  ])('hides $label while retaining a valid row', async ({ field, value }) => {
    const incomplete: Record<string, unknown> = { ...event(), id: 'incomplete', title: 'Incomplete Event', is_paid: true, currency: 'usd' };
    incomplete[field] = value;
    state.lists.set('events_public_browse', [incomplete, event()]);
    const client = renderPage();
    await waitList(client, 'success');
    expect(await screen.findByText('Synthetic Event')).toBeTruthy();
    expect(screen.queryByText('Incomplete Event')).toBeNull();
    expect(client.getQueryData(['feed-events', 'visitor'])).toEqual([expect.objectContaining({ id: event().id })]);
  });

  it('renders the existing paid-event detail for a null price and present currency', async () => {
    state.lists.set('events_public_browse', [{ ...event(), is_paid: true, price: null, currency: 'usd' }]);
    const client = renderPage();
    await waitList(client, 'success');
    fireEvent.click(await screen.findByText('Synthetic Event'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Paid Event')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /buy ticket/i })).toBeTruthy();
  });

  it('opens a valid public direct route with omitted attribution', async () => {
    state.singles.set('events_public_browse', event());
    const client = renderPage('/events/synthetic-event');
    await waitList(client, 'success'); await waitRoute(client, 'success');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(state.calls).toHaveBeenCalledWith('events_public_browse', 'eq', 'slug', 'synthetic-event');
    expect(client.getQueryData(['feed-route-event', 'synthetic-event', 'visitor'])).toEqual(expect.objectContaining({ user_id: '', author_identity: undefined, author_group_id: undefined, creator_profile: undefined }));
  });

  it('keeps the panel closed for an incomplete direct row', async () => {
    state.singles.set('events_public_browse', { ...event(), is_paid: null });
    const client = renderPage('/events/synthetic-event');
    await waitList(client, 'success'); await waitRoute(client, 'success');
    expect(client.getQueryData(['feed-route-event', 'synthetic-event', 'visitor'])).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exposes a returned public list error in the query state', async () => {
    state.errors.set('events_public_browse:list', new Error('list failed'));
    const client = renderPage();
    await waitList(client, 'error');
  });

  it('exposes a returned direct lookup error in the query state', async () => {
    state.errors.set('events_public_browse:single', new Error('lookup failed'));
    const client = renderPage('/events/synthetic-event');
    await waitList(client, 'success'); await waitRoute(client, 'error');
  });

  it('uses private list and direct queries with signed-in author enrichment', async () => {
    state.user.set('viewer', { id: 'viewer', email: 'viewer@example.test' });
    const privateEvent = { ...event(), user_id: 'author-1', author_identity: 'personal', author_group_id: null };
    state.lists.set('events', [privateEvent]); state.singles.set('events', privateEvent);
    const client = renderPage('/events/synthetic-event');
    await waitList(client, 'success', 'viewer'); await waitRoute(client, 'success', 'authenticated');
    expect(state.calls).toHaveBeenCalledWith('events', 'or', 'visibility.in.(public,network,specific),user_id.eq.viewer');
    expect(state.calls).toHaveBeenCalledWith('events', 'eq', 'slug', 'synthetic-event');
    expect(state.rpc).toHaveBeenCalledWith('get_public_profiles', { _user_ids: ['author-1'] });
    expect(client.getQueryData(['feed-route-event', 'synthetic-event', 'authenticated'])).toEqual(expect.objectContaining({ user_id: 'author-1', creator_profile: expect.objectContaining({ display_name: 'Synthetic Author' }) }));
  });
});
