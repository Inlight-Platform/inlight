import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import GroupPage from '../GroupPage';
import GroupAdminDashboardPage from '../GroupAdminDashboardPage';

const state = vi.hoisted(() => ({
  auditionError: null as Error | null,
  select: vi.fn(), eq: vi.fn(), order: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'member' } }) }));
vi.mock('@/hooks/useGroups', () => ({
  useGroupBySlug: () => ({ data: { id: 'g1', slug: 'school', name: 'School', faculty_owner_id: null, is_listed: true, members_can_post: false }, isLoading: false }),
  useMyGroups: () => ({ data: [{ id: 'g1', is_faculty: false }], isLoading: false }),
  useMyGroupsForUser: () => ({ data: [{ id: 'g1', is_faculty: false }], isLoading: false }),
  useMyScopedAdminGroups: () => ({ data: [{ id: 'g1', slug: 'school', name: 'School' }], isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (name: string) => ({
      data: name === 'group_page_visible_to_caller'
        ? true
        : name === 'get_group_audition_availability'
        ? [{ audition_id: 'audition-1', timeslot_id: 'slot-1', booked_count: 1, capacity: 3, is_my_timeslot: false }]
        : [],
      error: null,
    }),
    functions: { invoke: vi.fn() },
    from: (table: string) => {
      const rows: Record<string, unknown[]> = {
        group_auditions: [
          { id: 'audition-1', title: 'Synthetic Audition', description: 'Synthetic description', materials: 'Synthetic materials', is_published: true, created_at: '2026-01-01T00:00:00Z', group_audition_timeslots: [{ id: 'slot-1', starts_at: '2027-01-01T12:00:00Z', ends_at: '2027-01-01T13:00:00Z', capacity: 3 }] },
          { id: 'audition-empty', title: 'Empty Audition', description: '', materials: '', is_published: true, created_at: '2025-12-01T00:00:00Z', group_audition_timeslots: [] },
        ],
        group_audition_signups: [{ id: 'signup-1', audition_id: 'audition-1', timeslot_id: 'slot-1', user_id: 'member', created_at: '2026-01-01T00:00:00Z' }],
        profiles_public: [{ user_id: 'member', display_name: 'Synthetic Member', avatar_url: null }],
      };
      const chain = {
        select: (fields: string) => { state.select(table, fields); return chain; },
        eq: (column: string, value: unknown) => { state.eq(table, column, value); return chain; },
        order: (column: string, options: unknown) => { state.order(table, column, options); return chain; },
        in: () => chain, limit: () => chain, is: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: { data: unknown[] | null; error: Error | null }) => unknown) => {
          const error = table === 'group_auditions' ? state.auditionError : null;
          return Promise.resolve({ data: error ? null : rows[table] || [], error }).then(resolve);
        },
      };
      return chain;
    },
  },
}));

const selection = 'id, title, description, materials, is_published, created_at, group_audition_timeslots(id, starts_at, ends_at, capacity)';
const renderPage = (dashboard: boolean) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const path = dashboard ? '/groups/school/dashboard' : '/groups/school?tab=auditions';
  render(<TooltipProvider><MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}>
    <Routes><Route path="/groups/:slug/dashboard" element={<GroupAdminDashboardPage />} /><Route path="/groups/:slug/*" element={<GroupPage />} /></Routes>
  </QueryClientProvider></MemoryRouter></TooltipProvider>);
  return client;
};
const openDashboardAuditions = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Auditions' }), { button: 0, ctrlKey: false });
};
const expectQuery = (published: boolean) => {
  expect(state.select).toHaveBeenCalledWith('group_auditions', selection);
  expect(state.eq.mock.calls.filter(([table]) => table === 'group_auditions')).toEqual(
    published ? [['group_auditions', 'group_id', 'g1'], ['group_auditions', 'is_published', true]] : [['group_auditions', 'group_id', 'g1']],
  );
  expect(state.order).toHaveBeenCalledWith('group_auditions', 'created_at', { ascending: false });
};

beforeAll(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { state.auditionError = null; state.select.mockReset(); state.eq.mockReset(); state.order.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('embedded audition queries', () => {
  it('loads the dashboard selection and renders nested slots, roster and empty slots', async () => {
    const client = renderPage(true);
    await openDashboardAuditions();
    await waitFor(() => expect(client.getQueryState(['group-dashboard-auditions', 'g1'])?.status).toBe('success'));
    expectQuery(false);
    expect(await screen.findByText('Synthetic Member')).toBeTruthy();
    expect(screen.getByText('Synthetic description')).toBeTruthy();
    expect(screen.getByText(/Synthetic materials/)).toBeTruthy();
    expect(screen.getByText('Booked:').parentElement).toHaveTextContent('Booked: 1');
    expect(screen.getByText('Available:').parentElement).toHaveTextContent('Available: 2');
    const emptyCard = screen.getByText('Empty Audition').closest('div.space-y-3.rounded-lg.border.p-4');
    if (!(emptyCard instanceof HTMLElement)) throw new Error('Missing empty audition card');
    expect(within(emptyCard).queryByText('Capacity:')).toBeNull();
  });

  it('preserves the dashboard empty display after a returned query error', async () => {
    state.auditionError = new Error('audition read failed');
    const client = renderPage(true);
    await openDashboardAuditions();
    await waitFor(() => expect(client.getQueryState(['group-dashboard-auditions', 'g1'])?.status).toBe('error'));
    expectQuery(false);
    expect(await screen.findByText('No auditions yet.')).toBeTruthy();
  });

  it('loads published group auditions and renders nested availability', async () => {
    const client = renderPage(false);
    await waitFor(() => expect(client.getQueryState(['group-auditions', 'g1'])?.status).toBe('success'));
    await waitFor(() => expect(client.getQueryState(['group-audition-availability', 'g1', 'member'])?.status).toBe('success'));
    expectQuery(true);
    expect(await screen.findByText('Synthetic Audition')).toBeTruthy();
    expect(screen.getByText('Synthetic description')).toBeTruthy();
    expect(screen.getByText('Synthetic materials')).toBeTruthy();
    expect(screen.getByText('Capacity:').parentElement).toHaveTextContent('Capacity: 3');
    expect(screen.getByText('Available:').parentElement).toHaveTextContent('Available: 2');
    expect(screen.getByRole('button', { name: 'Reserve slot' })).toBeEnabled();
    expect(screen.getByText('Empty Audition')).toBeTruthy();
  });

  it('preserves the group empty display after a returned query error', async () => {
    state.auditionError = new Error('audition read failed');
    const client = renderPage(false);
    await waitFor(() => expect(client.getQueryState(['group-auditions', 'g1'])?.status).toBe('error'));
    expectQuery(true);
    expect(await screen.findByText('No published auditions yet.')).toBeTruthy();
  });
});
