import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { server } from '@/test-utils/msw/server';
import { FeedItem } from '../FeedItem';
import { ContentAudienceControl } from '../ContentAudienceControl';

const api = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: api }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useFeatureAccess', () => ({ useFeatureAccess: () => ({ canManageEvents: false, canManageJobs: false, canManageProjects: false }) }));
vi.mock('@/hooks/useGroups', () => ({ useMyGroups: () => ({ data: [{ id: 'g1', name: 'Drama', is_faculty: true }] }) }));
vi.mock('../AudienceSelector', () => ({ AudienceSelector: ({ onSelectedUsersChange }: { onSelectedUsersChange: (users: Array<{ user_id: string; display_name: string; avatar_url: null }>) => void }) => <button onClick={() => onSelectedUsersChange([{ user_id: 'u1', display_name: 'User', avatar_url: null }])}>Select user</button> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/usePostComments', () => ({ usePostCommentCount: () => ({ data: 0 }) }));
vi.mock('@/hooks/useEventRsvps', () => ({ useEventRsvps: () => ({ rsvps: [], goingRsvps: [], goingCount: 0, submitRsvp: vi.fn() }) }));

const renderWithProviders = (node: React.ReactNode) => render(
  <MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider></MemoryRouter>,
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.listen({ onUnhandledRequest: 'warn' }));
beforeEach(() => { api.rpc.mockReset(); api.from.mockReset(); vi.mocked(toast.error).mockClear(); });

describe('project audience labels', () => {
  it.each([
    ['project', 'You and project collaborators'],
    ['event', 'Only you'],
  ] as const)('shows the correct Private description for %s', async (contentType, description) => {
    renderWithProviders(<ContentAudienceControl contentType={contentType} contentId="p1" visibility="private" />);
    fireEvent.keyDown(screen.getByRole('button', { name: /private/i }), { key: 'ArrowDown' });
    expect((await screen.findByText(description, { exact: true })).closest('[role="menuitem"]')).toHaveTextContent('Private');
  });
  it('shows a neutral label for a legacy audience in the control', () => {
    renderWithProviders(<ContentAudienceControl contentType="project" contentId="p1" visibility={null} />);
    expect(screen.getByRole('button', { name: /legacy audience/i })).toBeInTheDocument();
  });

  it('sends a project audience selection through one atomic RPC', async () => {
    api.rpc.mockResolvedValue({ error: null });
    renderWithProviders(<ContentAudienceControl contentType="project" contentId="p1" visibility="private" />);
    fireEvent.keyDown(screen.getByRole('button', { name: /private/i }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /everyone/i }));
    await waitFor(() => expect(api.rpc).toHaveBeenCalledWith('set_project_audience', {
      target_project_id: 'p1', target_audience: 'public', target_group_id: null, target_recipient_ids: [],
    }));
    expect(api.from).not.toHaveBeenCalled();
  });

  it.each([
    { visibility: undefined, label: 'Legacy audience' },
    { visibility: 'private', label: 'Private' },
  ])('does not label $label projects as specific people', ({ visibility, label }) => {
    renderWithProviders(<FeedItem item={{ id: 'p1', type: 'project', user_id: 'owner', title: 'Project', created_at: '2026-01-01T00:00:00Z', visibility }} networkDegree={null} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText('Specific People')).not.toBeInTheDocument();
  });
});

describe('event audience writes', () => {
  const setupWrites = (failAt = -1) => {
    const operations: unknown[][] = [];
    const record = (...operation: unknown[]) => {
      operations.push(operation);
      return Promise.resolve({ error: operations.length === failAt ? new Error('write failed') : null });
    };
    api.from.mockImplementation((table: string) => ({
      delete: () => ({ eq: (key: string, value: string) => record(table, 'delete', key, value) }),
      update: (payload: unknown) => ({ eq: (key: string, value: string) => record(table, 'update', payload, key, value) }),
      insert: (payload: unknown) => record(table, 'insert', payload),
    }));
    return operations;
  };

  it('replaces specific recipients in order with event keys', async () => {
    const operations = setupWrites();
    const onChanged = vi.fn();
    renderWithProviders(<ContentAudienceControl contentType="event" contentId="e1" visibility="private" onChanged={onChanged} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /private/i }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /specific people/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Select user' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('specific'));
    expect(operations).toEqual([
      ['event_recipients', 'delete', 'event_id', 'e1'],
      ['event_groups', 'delete', 'event_id', 'e1'],
      ['events', 'update', { visibility: 'specific' }, 'id', 'e1'],
      ['event_recipients', 'insert', [{ event_id: 'e1', recipient_id: 'u1' }]],
    ]);
  });

  it('replaces group access in order with event keys', async () => {
    const operations = setupWrites();
    const onChanged = vi.fn();
    renderWithProviders(<ContentAudienceControl contentType="event" contentId="e1" visibility="private" onChanged={onChanged} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /private/i }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /drama/i }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('group'));
    expect(operations).toEqual([
      ['event_recipients', 'delete', 'event_id', 'e1'],
      ['event_groups', 'delete', 'event_id', 'e1'],
      ['events', 'update', { visibility: 'group' }, 'id', 'e1'],
      ['event_groups', 'insert', { event_id: 'e1', group_id: 'g1' }],
    ]);
  });

  it.each([1, 2, 3])('stops subsequent group writes when operation %i fails', async (failAt) => {
    const operations = setupWrites(failAt);
    const onChanged = vi.fn();
    renderWithProviders(<ContentAudienceControl contentType="event" contentId="e1" visibility="private" onChanged={onChanged} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /private/i }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /drama/i }));
    await waitFor(() => expect(operations).toHaveLength(failAt));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('write failed'));
    expect(operations).toHaveLength(failAt);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
