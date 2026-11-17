import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupAdminDashboardPage from '../GroupAdminDashboardPage';

const mocks = vi.hoisted(() => ({ admins: [] as Array<{ id: string; group_id: string; user_id: string | null; email: string; status: string; created_at: string }>, members: [] as Array<{ id: string; user_id: string; status: string; profile: { display_name: string } }>, adminsError: false, rpc: vi.fn() }));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({ data: queryKey[0] === 'group-dashboard-admins' ? mocks.admins : queryKey[0] === 'group-dashboard-members' ? mocks.members : [], isLoading: false, isError: queryKey[0] === 'group-dashboard-admins' && mocks.adminsError }) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-a' } }) }));
vi.mock('@/hooks/useGroups', () => ({
  useGroupBySlug: () => ({ data: { id: 'g1', slug: 'school', name: 'School', members_can_post: true, is_listed: true }, isLoading: false }),
  useMyScopedAdminGroups: () => ({ data: [{ id: 'g1', slug: 'school', name: 'School' }], isLoading: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: vi.fn() }, from: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const admin = (id: string, status: string) => ({ id, group_id: 'g1', user_id: status === 'active' ? id : null, email: `${id}@example.edu`, status, created_at: '2026-01-01T00:00:00Z' });
function renderDashboard() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  return { ...render(<MemoryRouter initialEntries={['/groups/school/dashboard']}><QueryClientProvider client={client}><Routes><Route path="/groups/:slug/dashboard" element={<GroupAdminDashboardPage />} /></Routes></QueryClientProvider></MemoryRouter>), invalidate };
}
describe('department admin removal controls', () => {
  beforeEach(() => { mocks.admins = []; mocks.members = []; mocks.adminsError = false; mocks.rpc.mockReset().mockResolvedValue({ error: null }); });
  it('badges only active admins in the active member roster', () => {
    mocks.admins = [admin('leader', 'active'), { ...admin('invitee', 'pending'), user_id: 'invitee' }];
    mocks.members = [{ id: 'm1', user_id: 'leader', status: 'active', profile: { display_name: 'Leader' } }, { id: 'm2', user_id: 'invitee', status: 'active', profile: { display_name: 'Member' } }];
    renderDashboard();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /invites/i }), { button: 0, ctrlKey: false });
    expect(screen.getAllByText('Admin')).toHaveLength(1);
    expect(screen.getByText('Leader').closest('.border-t')).toHaveTextContent('Admin');
    const leaderRow = screen.getByText('Leader').closest('.border-t') as HTMLElement;
    const memberRow = screen.getByText('Member').closest('.border-t') as HTMLElement;
    expect(within(leaderRow).getByText('Remove admin powers first.')).toBeInTheDocument();
    expect(within(leaderRow).getByRole('button', { name: /remove/i })).toBeDisabled();
    expect(within(memberRow).getByRole('button', { name: /remove/i })).toBeEnabled();
  });
  it('protects the only active admin while allowing a pending invite to be removed', () => {
    mocks.admins = [admin('active', 'active'), admin('pending', 'pending')];
    renderDashboard();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /invites/i }), { button: 0, ctrlKey: false });
    const activeRow = screen.getAllByText('active@example.edu')[0].closest('.rounded-lg') as HTMLElement;
    const pendingRow = screen.getAllByText('pending@example.edu')[0].closest('.rounded-lg') as HTMLElement;
    expect(within(activeRow).getByText('Active')).toBeInTheDocument();
    expect(within(activeRow).getByRole('button', { name: /^remove$/i })).toBeDisabled();
    expect(within(pendingRow).getByText('Pending')).toBeInTheDocument();
    expect(within(pendingRow).getByRole('button', { name: /cancel invite/i })).toBeEnabled();
    fireEvent.click(within(pendingRow).getByRole('button', { name: /cancel invite/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cancel admin invite?');
  });
  it('offers removal of either of two admins and explains membership stays', () => {
    mocks.admins = [admin('first', 'active'), admin('second', 'active')];
    renderDashboard();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /invites/i }), { button: 0, ctrlKey: false });
    const buttons = screen.getAllByRole('button', { name: /^remove$/i });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeEnabled();
    fireEvent.click(buttons[0]);
    expect(screen.getByText(/active admins remain group members; removing membership is separate/i)).toBeInTheDocument();
  });
  it('disables member removal when admin status failed to load', () => {
    mocks.adminsError = true;
    mocks.members = [{ id: 'm', user_id: 'person', status: 'active', profile: { display_name: 'Person' } }];
    renderDashboard();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /invites/i }), { button: 0, ctrlKey: false });
    expect(within(screen.getByText('Person').closest('.border-t') as HTMLElement).getByRole('button', { name: /remove/i })).toBeDisabled();
  });
  it('refreshes roster, count and admin IDs after removing admin powers', async () => {
    mocks.admins = [admin('first', 'active'), admin('second', 'active')];
    const { invalidate } = renderDashboard();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /invites/i }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('remove_group_admin', { _admin_id: 'first' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group-active-admin-user-ids', 'g1'] }));
    for (const key of ['group-members', 'group-dashboard-members', 'group-active-member-count']) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key, 'g1'] });
    }
  });
});
