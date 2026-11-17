import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import GroupPage from '../GroupPage';
import GroupAdminDashboardPage from '../GroupAdminDashboardPage';

const state = vi.hoisted(() => ({
  member: true, admin: true, availability: [] as Array<{ audition_id: string; timeslot_id: string; booked_count: number; capacity: number; is_my_timeslot: boolean | null }>,
  bookError: null as Error | null, rpc: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'member' } }) }));
vi.mock('@/hooks/useGroups', () => ({
  useGroupBySlug: () => ({ data: { id: 'g1', slug: 'school', name: 'School', faculty_owner_id: null, is_listed: true, members_can_post: false }, isLoading: false }),
  useMyGroups: () => ({ data: state.member ? [{ id: 'g1', is_faculty: false }] : [], isLoading: false }),
  useMyGroupsForUser: () => ({ data: state.member ? [{ id: 'g1', is_faculty: false }] : [], isLoading: false }),
  useMyScopedAdminGroups: () => ({ data: state.admin ? [{ id: 'g1', slug: 'school', name: 'School' }] : [], isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error, warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc, functions: { invoke: vi.fn() },
    from: (table: string) => {
      const rows = table === 'group_auditions' ? [{
        id: 'audition-1', title: 'Synthetic Audition', description: '', materials: '', is_published: true,
        created_at: '2026-01-01T00:00:00Z',
        group_audition_timeslots: [{ id: 'slot-1', starts_at: '2027-01-01T12:00:00Z', ends_at: '2027-01-01T13:00:00Z', capacity: 2 }],
      }] : [];
      const result = { data: rows, error: null };
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain, is: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  },
}));

const renderPage = (dashboard = false) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const path = dashboard ? '/groups/school/dashboard' : '/groups/school?tab=auditions';
  render(<TooltipProvider><MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}>
    <Routes><Route path="/groups/:slug/dashboard" element={<GroupAdminDashboardPage />} /><Route path="/groups/:slug/*" element={<GroupPage />} /></Routes>
  </QueryClientProvider></MemoryRouter></TooltipProvider>);
  return { client, invalidate };
};
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => {
  state.member = true; state.admin = true; state.availability = []; state.bookError = null;
  state.rpc.mockReset(); state.success.mockReset(); state.error.mockReset();
  state.rpc.mockImplementation(async (name: string) => name === 'group_page_visible_to_caller'
    ? { data: true, error: null }
    : name === 'get_group_audition_availability'
    ? { data: state.availability, error: null }
    : { data: name === 'book_group_audition_timeslot' ? 'signup-1' : [], error: name === 'book_group_audition_timeslot' ? state.bookError : null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('audition availability and booking', () => {
  it.each([null, false, true])('renders ownership %s', async (mine) => {
    state.availability = [{ audition_id: 'audition-1', timeslot_id: 'slot-1', booked_count: 1, capacity: 2, is_my_timeslot: mine }];
    const { client } = renderPage();
    await screen.findByText('Synthetic Audition');
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('get_group_audition_availability', { _group_id: 'g1' }));
    expect(await screen.findByRole('button', { name: mine ? 'Selected' : 'Reserve slot' })).toBeTruthy();
    await waitFor(() => expect(client.getQueryState(['group-audition-availability', 'g1', 'member'])?.status).toBe('success'));
    await waitFor(() => expect(screen.getByText('Available:').parentElement).toHaveTextContent(/^Available:\s*1$/));
  });

  it('uses slot capacity when availability is missing', async () => {
    const { client } = renderPage();
    await screen.findByText('Synthetic Audition');
    expect(await screen.findByRole('button', { name: 'Reserve slot' })).toBeTruthy();
    await waitFor(() => expect(client.getQueryState(['group-audition-availability', 'g1', 'member'])?.status).toBe('success'));
    await waitFor(() => expect(screen.getByText('Available:').parentElement).toHaveTextContent(/^Available:\s*2$/));
  });

  it('disables a full slot and books an available slot with exact IDs', async () => {
    state.availability = [{ audition_id: 'audition-1', timeslot_id: 'slot-1', booked_count: 2, capacity: 2, is_my_timeslot: false }];
    const { client, invalidate } = renderPage();
    await screen.findByText('Synthetic Audition');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reserve slot' })).toBeDisabled());
    state.availability = [{ ...state.availability[0], booked_count: 1 }];
    await client.invalidateQueries({ queryKey: ['group-audition-availability', 'g1'] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reserve slot' })).toBeEnabled());
    invalidate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reserve slot' }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Audition timeslot reserved'));
    expect(state.rpc).toHaveBeenCalledWith('book_group_audition_timeslot', { _audition_id: 'audition-1', _timeslot_id: 'slot-1' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group-audition-availability', 'g1'] });
  });

  it('reports a booking error', async () => {
    state.bookError = new Error('booking failed');
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reserve slot' }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('booking failed'));
  });

  it('does not request availability without group access', async () => {
    state.member = false;
    renderPage();
    await screen.findByText('Private group');
    expect(state.rpc).not.toHaveBeenCalledWith('get_group_audition_availability', expect.anything());
  });
});

describe('audition creation', () => {
  it('validates timeslots and sends the serialized form', async () => {
    const { invalidate } = renderPage(true);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Auditions' }), { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  New audition  ' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2027-01-01T13:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-01-01T12:00' } });
    const form = screen.getByLabelText('Title').closest('form');
    if (!form) throw new Error('Missing audition form');
    fireEvent.submit(form);
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('Each timeslot must end after it starts.'));
    expect(state.rpc).not.toHaveBeenCalledWith('create_group_audition', expect.anything());
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2027-01-01T14:00' } });
    fireEvent.submit(form);
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('create_group_audition', {
      _group_id: 'g1', _title: 'New audition', _description: '', _materials: '', _is_published: false,
      _timeslots: [{ starts_at: new Date('2027-01-01T13:00').toISOString(), ends_at: new Date('2027-01-01T14:00').toISOString(), capacity: 1 }],
    }));
    await waitFor(() => expect(state.success).toHaveBeenCalledWith('Audition created'));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Materials')).toHaveValue('');
    expect(screen.getByLabelText('Starts')).toHaveValue('');
    expect(screen.getByLabelText('Ends')).toHaveValue('');
    expect(screen.getByLabelText('Capacity')).toHaveValue(1);
    expect(screen.getByRole('switch', { name: 'Published' })).not.toBeChecked();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group-dashboard-auditions', 'g1'] });
  });

  it('does not expose creation without scoped admin access', async () => {
    state.admin = false;
    renderPage(true);
    await screen.findByText('Only admins directly assigned to School can manage this dashboard.');
    expect(screen.queryByText('Create Audition')).toBeNull();
    expect(state.rpc).not.toHaveBeenCalledWith('create_group_audition', expect.anything());
  });
});
