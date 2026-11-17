import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupPage from '../GroupPage';
import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test-utils/msw/server';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';

const state = vi.hoisted(() => ({ userId: 'member' as string | null, authLoading: false, queryKeys: [] as unknown[][], available: false, member: false, pending: false, faculty: false, admins: [] as Array<{ id: string; email: string; status: string; user_id?: string | null }>, members: [] as Array<{ id: string; user_id: string; status: string; profile: { display_name: string } }>, activeAdminIds: [] as string[], adminIdsError: false, groupAdminsError: false, items: [] as Array<{ id: string; type: 'project' | 'event'; user_id: string; title: string; created_at: string }>, invalidate: vi.fn(), rpc: vi.fn() }));
const navigationFixtures = vi.hoisted(() => ({ posts: [] as Array<{ id: string; user_id: string; content: string; created_at: string }>, syntheticShow: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.userId ? { id: state.userId } : null, loading: state.authLoading }) }));
vi.mock('@/hooks/useGroups', () => ({
  useGroupBySlug: () => ({ data: state.available ? { id: 'g', slug: 'school', name: 'School', faculty_owner_id: null, is_listed: true, members_can_post: false } : null, isLoading: false }),
  useMyGroups: () => ({ data: state.member ? [{ id: 'g', is_faculty: state.faculty }] : [], isLoading: false }),
  useMyGroupsForUser: () => ({ data: state.member ? [{ id: 'g', is_faculty: state.faculty }] : [], isLoading: false }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => { state.queryKeys.push(queryKey); return ({ data: queryKey[0] === 'group-projects' ? state.items.filter(item => item.type === 'project') : queryKey[0] === 'group-events' ? state.items.filter(item => item.type === 'event') : queryKey[0] === 'group-posts' ? navigationFixtures.posts : queryKey[0] === 'group-admins' ? state.admins : queryKey[0] === 'group-members' ? state.members : queryKey[0] === 'group-active-admin-user-ids' ? state.activeAdminIds : queryKey[0] === 'my-group-membership' && state.pending ? { status: 'pending' } : undefined, isLoading: false, isError: (queryKey[0] === 'group-active-admin-user-ids' && state.adminIdsError) || (queryKey[0] === 'group-admins' && state.groupAdminsError) }); },
  useMutation: (options: { mutationFn: (arg: unknown) => Promise<unknown>; onSuccess?: (data: unknown, arg: unknown) => void; onError?: (error: unknown) => void }) => ({ mutate: (arg: unknown) => { void options.mutationFn(arg).then((data) => options.onSuccess?.(data, arg)).catch((error) => options.onError?.(error)); }, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc, from: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/feed/FeedBentoCard', () => ({ getBentoSize: () => 'small', FeedBentoCardWithComments: ({ item, onClick }: { item: { title?: string; content?: string; type: string }; onClick: () => void }) => <button onClick={() => { if (navigationFixtures.syntheticShow) item.type = 'show'; onClick(); }}>{item.title || item.content}</button> }));
vi.mock('@/components/feed/FeedItem', () => ({ FeedItem: (props: { item: { title: string }; deleteDialogDescription?: string; deleteDialogConfirmLabel?: string; deleteDialogPendingLabel?: string }) => {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  return <><button onClick={() => setOpen(true)}>Open removal for {props.item.title}</button><DeleteConfirmDialog open={open} onOpenChange={(next) => { if (next) setOpen(true); }} onConfirm={() => setPending(true)} description={props.deleteDialogDescription} confirmLabel={props.deleteDialogConfirmLabel} pendingLabel={props.deleteDialogPendingLabel} isPending={pending} /></>;
} }));

const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => { server.listen({ onUnhandledRequest: 'error' }); Element.prototype.scrollIntoView = vi.fn(); });
afterAll(() => { server.listen({ onUnhandledRequest: 'warn' }); Element.prototype.scrollIntoView = originalScrollIntoView; });

function openGroup(entry = '/groups/school') {
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>;
  }
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><LocationProbe /><Routes><Route path="/groups/:slug/*" element={<GroupPage />} /><Route path="/stage-whisper" element={null} /></Routes></MemoryRouter></TooltipProvider>);
}
describe('group readiness display', () => {
  beforeEach(() => { state.userId = 'member'; state.authLoading = false; state.queryKeys = []; state.items = []; navigationFixtures.posts = []; navigationFixtures.syntheticShow = false; state.admins = []; state.members = []; state.activeAdminIds = []; state.faculty = false; state.adminIdsError = false; state.groupAdminsError = false; state.invalidate.mockReset(); state.rpc.mockReset().mockResolvedValue({ data: true, error: null }); });
  it('preserves the full return path for a synthetic mocked show-item fallback', async () => {
    state.available = true; state.member = true; state.pending = false;
    state.items = [{ id: '12345678-1234-4123-8123-123456789abc', type: 'project', user_id: 'owner', title: 'Fixture', created_at: '2026-01-01T00:00:00Z' }];
    navigationFixtures.syntheticShow = true;
    openGroup('/groups/school?tab=all#section');
    await screen.findByText('School');
    fireEvent.click(screen.getByRole('button', { name: 'Fixture' }));
    expect(JSON.parse(screen.getByTestId('location').textContent || '{}')).toEqual({ pathname: '/stage-whisper', state: { returnTo: '/groups/school?tab=all#section' } });
  });
  it.each(['project', 'event', 'post'] as const)('opens the group-specific %s route', async (type) => {
    state.available = true; state.member = true; state.pending = false;
    const id = '12345678-1234-4123-8123-123456789abc';
    if (type === 'post') navigationFixtures.posts = [{ id, user_id: 'owner', content: 'Fixture', created_at: '2026-01-01T00:00:00Z' }];
    else state.items = [{ id, type, user_id: 'owner', title: 'Fixture', created_at: '2026-01-01T00:00:00Z' }];
    openGroup();
    await screen.findByText('School');
    fireEvent.click(screen.getByRole('button', { name: 'Fixture' }));
    expect(JSON.parse(screen.getByTestId('location').textContent || '{}').pathname).toBe(`/groups/school/${type === 'post' ? 'posts' : type === 'event' ? 'events' : 'projects'}/fixture-12345678`);
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith('group_page_visible_to_caller', { _group_id: 'g' });
  });
  it.each([['project', 'details'], ['project', 'list'], ['event', 'details'], ['event', 'list']] as const)('passes %s removal wording in the %s path', async (type, path) => {
    state.available = true; state.member = true; state.faculty = true; state.pending = false;
    state.items = [{ id: 'fixture', type, user_id: 'owner', title: 'Fixture', created_at: '2026-01-01T00:00:00Z' }];
    openGroup();
    await screen.findByText('School');
    if (path === 'details') {
      fireEvent.click(screen.getByRole('button', { name: 'Fixture' }));
    } else {
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('option', { name: 'List' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Open removal for Fixture' }));
    const description = type === 'project' ? "This removes the project from School's feed. Its creator, project members, and invitees keep their access." : 'This removes the event from School and makes it private to its creator.';
    expect(screen.getByRole('alertdialog')).toHaveTextContent(description);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: type === 'project' ? 'Remove' : 'Delete' }));
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: type === 'project' ? 'Removing...' : 'Deleting...' })).toBeDisabled();
  });
  it('does not offer a request when the group is unavailable', async () => {
    state.available = false; state.member = false; state.pending = false;
    openGroup();
    expect(screen.getByText(/not currently available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request to join/i })).not.toBeInTheDocument();
  });
  it('retains existing member content access', async () => {
    state.available = true; state.member = true; state.pending = false;
    openGroup();
    await screen.findByText('School');
    expect(screen.getByText('School')).toBeInTheDocument();
    expect(screen.queryByText('Private group')).not.toBeInTheDocument();
  });
  it('shows a pending request instead of a second request button', async () => {
    state.available = true; state.member = false; state.pending = true;
    openGroup();
    await screen.findByText('School');
    expect(screen.getByText('Request pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request to join/i })).not.toBeInTheDocument();
  });
  it('labels active and pending admins and protects the only active admin', async () => {
    state.available = true; state.member = true; state.pending = false; state.faculty = true;
    state.admins = [{ id: 'a', email: 'active@example.edu', status: 'active' }, { id: 'p', email: 'pending@example.edu', status: 'pending' }];
    openGroup('/groups/school?tab=members');
    await screen.findByText('School');
    const activeRow = screen.getAllByText('active@example.edu')[0].closest('.rounded-md') as HTMLElement;
    const pendingRow = screen.getAllByText('pending@example.edu')[0].closest('.rounded-md') as HTMLElement;
    expect(within(activeRow).getByText('Active')).toBeInTheDocument();
    expect(within(activeRow).getByRole('button', { name: /^remove$/i })).toBeDisabled();
    expect(within(pendingRow).getByText('Pending')).toBeInTheDocument();
    expect(within(pendingRow).getByRole('button', { name: /cancel invite/i })).toBeEnabled();
    fireEvent.click(within(pendingRow).getByRole('button', { name: /cancel invite/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cancel admin invite?');
  });
  it('badges active admins in the member list using the active admin IDs', async () => {
    state.available = true; state.member = true; state.faculty = true; state.pending = false; state.admins = [];
    state.members = [{ id: 'm1', user_id: 'leader', status: 'active', profile: { display_name: 'Leader' } }, { id: 'm2', user_id: 'ordinary', status: 'active', profile: { display_name: 'Member' } }];
    state.activeAdminIds = ['leader'];
    openGroup('/groups/school?tab=members');
    await screen.findByText('School');
    expect(screen.getByText('Leader').closest('button')).toHaveTextContent('Admin');
    expect(screen.getByText('Member').closest('button')).not.toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /remove leader/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove member/i })).toBeEnabled();
    expect(screen.getByText('Remove admin powers first.')).toBeInTheDocument();
  });
  it('disables member removal if active admin IDs fail to load', async () => {
    state.available = true; state.member = true; state.faculty = true; state.pending = false; state.adminIdsError = true;
    state.members = [{ id: 'm', user_id: 'person', status: 'active', profile: { display_name: 'Person' } }];
    openGroup('/groups/school?tab=members');
    await screen.findByText('School');
    expect(screen.getByRole('button', { name: /remove person/i })).toBeDisabled();
  });
  it('protects an active admin tile even when the active-ID RPC returns no IDs', async () => {
    state.available = true; state.member = true; state.faculty = true; state.pending = false;
    state.activeAdminIds = [];
    state.admins = [{ id: 'a', user_id: 'admin-user', email: 'admin@example.edu', status: 'active' }, { id: 'p', user_id: 'other-user', email: 'other@example.edu', status: 'pending' }];
    state.members = [{ id: 'm1', user_id: 'admin-user', status: 'active', profile: { display_name: 'Local Admin' } }, { id: 'm2', user_id: 'other-user', status: 'active', profile: { display_name: 'Other Member' } }];
    openGroup('/groups/school?tab=members');
    await screen.findByText('School');
    expect(screen.getByText('Local Admin').closest('button')).toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /remove local admin/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove local admin/i })).toHaveAttribute('title', 'Remove admin powers first.');
    expect(screen.getByRole('button', { name: /remove other member/i })).toBeEnabled();
    expect(screen.getByText('Other Member').closest('button')).not.toHaveTextContent('Admin');
  });
  it('disables removal if the admin list fails to load', async () => {
    state.available = true; state.member = true; state.faculty = true; state.pending = false; state.groupAdminsError = true;
    state.members = [{ id: 'm', user_id: 'person', status: 'active', profile: { display_name: 'Person' } }];
    openGroup('/groups/school?tab=members');
    await screen.findByText('School');
    expect(screen.getByRole('button', { name: /remove person/i })).toBeDisabled();
  });
  it('refreshes roster, count and admin IDs after removing admin powers', async () => {
    state.available = true; state.member = true; state.faculty = true; state.pending = false;
    state.admins = [{ id: 'a', email: 'a@example.edu', status: 'active' }, { id: 'b', email: 'b@example.edu', status: 'active' }];
    openGroup('/groups/school?tab=members');
    await screen.findByText('School');
    const row = screen.getAllByText('a@example.edu')[0].closest('.rounded-md') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /^remove$/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('remove_group_admin', { _admin_id: 'a' }));
    await waitFor(() => expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ['group-active-admin-user-ids', 'g'] }));
    for (const key of ['group-members', 'group-dashboard-members', 'group-active-member-count']) {
      expect(state.invalidate).toHaveBeenCalledWith({ queryKey: [key, 'g'] });
    }
  });
  it('holds content queries until the fresh page decision allows', async () => {
    state.available = true; state.member = true; state.pending = false;
    let resolve!: (value: { data: boolean; error: null }) => void;
    state.rpc.mockImplementationOnce(() => new Promise((yes) => { resolve = yes; }));
    openGroup();
    expect(screen.queryByText('School')).not.toBeInTheDocument();
    expect(state.queryKeys).toHaveLength(0);
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('group_page_visible_to_caller', { _group_id: 'g' }));
    await act(async () => { resolve({ data: true, error: null }); });
    expect(await screen.findByText('School')).toBeInTheDocument();
    expect(state.queryKeys.some((key) => key[0] === 'group-projects')).toBe(true);
  });

  it.each([false, null, undefined, 'true'])('fails closed for decision %s', async (data) => {
    state.available = true; state.member = false; state.pending = false;
    state.rpc.mockResolvedValue({ data, error: null });
    openGroup();
    expect(await screen.findByText(/not currently available/i)).toBeInTheDocument();
    expect(screen.queryByText('School')).not.toBeInTheDocument();
  });

  it('fails closed on a missing or rejected RPC', async () => {
    state.available = true; state.member = false; state.pending = false;
    state.rpc.mockRejectedValue(new Error('missing function'));
    openGroup();
    expect(await screen.findByText(/not currently available/i)).toBeInTheDocument();
  });

  it('does not reuse a late identity decision after A to B to A', async () => {
    state.available = true; state.member = true; state.pending = false;
    const responses: Array<(value: { data: boolean; error: null }) => void> = [];
    state.rpc.mockImplementation(() => new Promise((yes) => { responses.push(yes); }));
    const wrap = () => <TooltipProvider><MemoryRouter initialEntries={['/groups/school']}><Routes><Route path="/groups/:slug/*" element={<GroupPage />} /></Routes></MemoryRouter></TooltipProvider>;
    state.userId = 'a';
    const { rerender } = render(wrap());
    await waitFor(() => expect(responses).toHaveLength(1));
    state.userId = 'b'; rerender(wrap());
    await waitFor(() => expect(responses).toHaveLength(2));
    state.userId = 'a'; rerender(wrap());
    await waitFor(() => expect(responses).toHaveLength(3));
    await act(async () => { responses[0]({ data: true, error: null }); responses[1]({ data: true, error: null }); });
    expect(screen.queryByText('School')).not.toBeInTheDocument();
    await act(async () => { responses[2]({ data: false, error: null }); });
    expect(screen.getByText(/not currently available/i)).toBeInTheDocument();
  });

  it('unmounts allowed content during auth loading and fetches fresh access afterward', async () => {
    state.available = true; state.member = true; state.pending = false;
    const wrap = () => <TooltipProvider><MemoryRouter initialEntries={['/groups/school']}><Routes><Route path="/groups/:slug/*" element={<GroupPage />} /></Routes></MemoryRouter></TooltipProvider>;
    const { rerender } = render(wrap());
    await screen.findByText('School');
    state.authLoading = true; rerender(wrap());
    expect(screen.queryByText('School')).not.toBeInTheDocument();
    state.rpc.mockResolvedValue({ data: false, error: null });
    state.authLoading = false; rerender(wrap());
    expect(await screen.findByText(/not currently available/i)).toBeInTheDocument();
  });

});
