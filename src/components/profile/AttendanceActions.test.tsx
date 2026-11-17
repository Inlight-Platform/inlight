import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddAttendedDialog } from './AddAttendedDialog';
import { AttendedSection } from './AttendedSection';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn(), success: vi.fn(), error: vi.fn(),
  existing: null as { id: string } | null,
  fallbackError: null as Error | null,
  markError: null as Error | null,
  removeError: null as Error | null,
  rows: [] as Array<{ id: string; kind: string; source: string; title: string; description: null; image_url: null; event_date: string; location: null }>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner', email: 'owner@example.test', user_metadata: { display_name: 'Owner' } } }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === 'events') {
        const chain = {
          select: () => chain, lte: () => chain, order: () => chain,
          limit: async () => ({ data: [{ id: 'event-1', title: 'Past Event', event_date: '2025-01-01T00:00:00Z', location: null }], error: null }),
        };
        return chain;
      }
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => { mocks.eq(column, value); return chain; },
        maybeSingle: async () => ({ data: mocks.existing, error: null }),
        update: (payload: unknown) => { mocks.update(payload); return chain; },
        insert: async (payload: unknown) => { mocks.insert(payload); return { error: mocks.fallbackError }; },
        then: (resolve: (value: { error: Error | null }) => unknown) =>
          Promise.resolve({ error: mocks.fallbackError }).then(resolve),
      };
      return chain;
    },
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  mocks.existing = null; mocks.fallbackError = null; mocks.markError = null; mocks.removeError = null; mocks.rows = [];
  mocks.rpc.mockReset(); mocks.update.mockReset(); mocks.insert.mockReset(); mocks.eq.mockReset();
  mocks.success.mockReset(); mocks.error.mockReset();
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'get_profile_attendance') return { data: mocks.rows, error: null };
    if (name === 'mark_event_attended') return { data: null, error: mocks.markError };
    return { data: null, error: mocks.removeError };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const renderWithClient = (component: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
  return invalidate;
};

const chooseEvent = async () => {
  fireEvent.keyDown(screen.getByRole('button', { name: /mark attended/i }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Event' }));
  fireEvent.click(await screen.findByText('Past Event'));
};

describe('event attendance', () => {
  it('marks by RPC without direct writes and refreshes', async () => {
    const invalidate = renderWithClient(<AddAttendedDialog />);
    await chooseEvent();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Marked "Past Event" as attended'));
    expect(mocks.rpc).toHaveBeenCalledWith('mark_event_attended', { _event_id: 'event-1' });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attended-events', 'owner'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile-section-content', 'owner'] });
    await waitFor(() => expect(screen.queryByText('Mark a past event as attended')).toBeNull());
  });

  it('updates the existing RSVP after an RPC error', async () => {
    mocks.markError = new Error('rpc failed'); mocks.existing = { id: 'rsvp-1' };
    renderWithClient(<AddAttendedDialog />);
    await chooseEvent();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Marked "Past Event" as attended'));
    expect(mocks.rpc).toHaveBeenCalledWith('mark_event_attended', { _event_id: 'event-1' });
    expect(mocks.eq).toHaveBeenCalledWith('event_id', 'event-1');
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(mocks.update).toHaveBeenCalledWith({ attended: true, attended_at: '2026-06-15T12:00:00.000Z', status: 'going' });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'rsvp-1');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('inserts a missing RSVP after an RPC error', async () => {
    mocks.markError = new Error('rpc failed');
    renderWithClient(<AddAttendedDialog />);
    await chooseEvent();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Marked "Past Event" as attended'));
    expect(mocks.insert).toHaveBeenCalledWith({
      event_id: 'event-1', user_id: 'owner', name: 'Owner', email: 'owner@example.test',
      role_type: 'audience', status: 'going', attended: true, attended_at: '2026-06-15T12:00:00.000Z',
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('reports fallback failure without success', async () => {
    mocks.markError = new Error('rpc failed'); mocks.fallbackError = new Error('fallback failed');
    renderWithClient(<AddAttendedDialog />);
    await chooseEvent();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('fallback failed'));
    expect(mocks.success).not.toHaveBeenCalled();
  });
});

describe('attendance removal', () => {
  it.each([['event', 'rsvp'], ['show', 'show']])('removes a %s and invalidates queries', async (kind, source) => {
    mocks.rows = [{ id: 'item-1', kind, source, title: 'Attended Item', description: null, image_url: null, event_date: '2025-01-01T00:00:00Z', location: null }];
    const invalidate = renderWithClient(<AttendedSection userId="owner" isOwnProfile />);
    fireEvent.click(await screen.findByTitle('Remove Attended Item from attended'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Removed from attended'));
    expect(mocks.rpc).toHaveBeenCalledWith('remove_profile_attendance', { _kind: kind, _item_id: 'item-1' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attended-events', 'owner'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile-section-content', 'owner'] });
  });

  it('reports an RPC removal error', async () => {
    mocks.rows = [{ id: 'event-1', kind: 'event', source: 'rsvp', title: 'Attended Event', description: null, image_url: null, event_date: '2025-01-01T00:00:00Z', location: null }];
    mocks.removeError = new Error('remove failed');
    renderWithClient(<AttendedSection userId="owner" isOwnProfile />);
    fireEvent.click(await screen.findByTitle('Remove Attended Event from attended'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('remove failed'));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('offers no removal control for ticket attendance', async () => {
    mocks.rows = [{ id: 'ticket-1', kind: 'event', source: 'ticket', title: 'Ticket Event', description: null, image_url: null, event_date: '2025-01-01T00:00:00Z', location: null }];
    renderWithClient(<AttendedSection userId="owner" isOwnProfile />);
    await screen.findByText('Ticket Event');
    expect(screen.queryByTitle('Remove Ticket Event from attended')).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalledWith('remove_profile_attendance', expect.anything());
  });
});
