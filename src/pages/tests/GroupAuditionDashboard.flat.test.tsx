import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupAdminDashboardPage from '../GroupAdminDashboardPage';

const state = vi.hoisted(() => ({
  published: false, updateError: null as Error | null,
  from: vi.fn(), update: vi.fn(), eq: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/hooks/useGroups', () => ({
  useGroupBySlug: () => ({ data: { id: 'g1', slug: 'school', name: 'School', members_can_post: true, is_listed: true }, isLoading: false }),
  useMyScopedAdminGroups: () => ({ data: [{ id: 'g1', slug: 'school', name: 'School' }], isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error, warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async () => ({ data: [], error: null }), functions: { invoke: vi.fn() },
    from: (table: string) => {
      state.from(table);
      let updating = false;
      const audition = {
        id: 'audition-1', title: 'Synthetic Audition', description: '', materials: '',
        is_published: state.published, created_at: '2026-01-01T00:00:00Z',
        group_audition_timeslots: [{ id: 'slot-1', starts_at: '2027-01-01T12:00:00Z', ends_at: '2027-01-01T13:00:00Z', capacity: 3 }],
      };
      const rows: Record<string, unknown[]> = {
        group_auditions: [audition],
        group_audition_signups: [
          { id: 's1', audition_id: 'audition-1', timeslot_id: 'slot-1', user_id: 'missing', created_at: '2026-01-01T00:00:00Z' },
          { id: 's2', audition_id: 'audition-1', timeslot_id: 'slot-1', user_id: 'member', created_at: '2026-01-02T00:00:00Z' },
        ],
        profiles_public: [
          { user_id: null, display_name: 'Null ID profile', avatar_url: null },
          { user_id: 'member', display_name: 'Synthetic Member', avatar_url: null },
        ],
      };
      const chain = {
        select: () => chain, in: () => chain, order: () => chain, limit: () => chain,
        eq: (column: string, value: string) => { if (updating) state.eq(column, value); return chain; },
        update: (payload: unknown) => { updating = true; state.update(table, payload); return chain; },
        then: (resolve: (value: { data: unknown[] | null; error: Error | null }) => unknown) =>
          Promise.resolve(updating ? { data: null, error: state.updateError } : { data: rows[table] || [], error: null }).then(resolve),
      };
      return chain;
    },
  },
}));

const renderDashboard = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<MemoryRouter initialEntries={['/groups/school/dashboard']}><QueryClientProvider client={client}>
    <Routes><Route path="/groups/:slug/dashboard" element={<GroupAdminDashboardPage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  return invalidate;
};
const openAuditions = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Auditions' }), { button: 0, ctrlKey: false });
  await screen.findByText('Synthetic Audition');
};
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => {
  state.published = false; state.updateError = null;
  state.from.mockReset(); state.update.mockReset(); state.eq.mockReset(); state.success.mockReset(); state.error.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('dashboard audition roster and publication', () => {
  it('counts both signups and falls back when a profile is absent or has a null ID', async () => {
    renderDashboard();
    await openAuditions();
    expect(await screen.findByText('Synthetic Member')).toBeTruthy();
    expect(screen.getByText('Department member')).toBeTruthy();
    expect(screen.queryByText('Null ID profile')).toBeNull();
    expect(screen.getByText(/2 signups/)).toBeTruthy();
    expect(screen.getByText('Booked:').parentElement).toHaveTextContent('Booked: 2');
    expect(screen.getByText('Available:').parentElement).toHaveTextContent('Available: 1');
    expect(state.from).toHaveBeenCalledWith('group_audition_signups');
  });

  it.each([[false, 'Publish', true, 'Audition published'], [true, 'Unpublish', false, 'Audition moved to drafts']] as const)(
    'updates publication from %s', async (initial, label, value, message) => {
      state.published = initial;
      const invalidate = renderDashboard();
      await openAuditions();
      invalidate.mockClear();
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(state.success).toHaveBeenCalledWith(message));
      expect(state.update).toHaveBeenCalledOnce();
      const [table, payload] = state.update.mock.calls[0];
      expect(table).toBe('group_auditions');
      expect(payload).toEqual({ is_published: value, updated_at: expect.any(String) });
      expect(new Date(payload.updated_at).toISOString()).toBe(payload.updated_at);
      expect(state.eq.mock.calls).toEqual([['id', 'audition-1'], ['group_id', 'g1']]);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group-dashboard-auditions', 'g1'] });
    },
  );

  it('preserves the update error feedback without success invalidation', async () => {
    state.updateError = new Error('publication failed');
    const invalidate = renderDashboard();
    await openAuditions();
    invalidate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('publication failed'));
    expect(state.update).toHaveBeenCalledWith('group_auditions', { is_published: true, updated_at: expect.any(String) });
    const payload = state.update.mock.calls[0][1];
    expect(new Date(payload.updated_at).toISOString()).toBe(payload.updated_at);
    expect(state.eq.mock.calls).toEqual([['id', 'audition-1'], ['group_id', 'g1']]);
    expect(state.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
