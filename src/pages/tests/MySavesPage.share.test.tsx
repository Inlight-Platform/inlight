import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSharedItem } from '@/components/messages/SharedItemCard';
import { ShareDialog } from '../MySavesPage';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), toastError: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'sender' } }) }));
vi.mock('@/hooks/useGroupChats', () => ({ useGroupChats: () => ({ groupChats: [{ id: 'chat', name: 'Team chat' }] }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: [{ user_id: 'recipient' }], error: null })),
    from: (table: string) => ({
      select: () => ({ in: async () => ({ data: [{ user_id: 'recipient', display_name: 'Recipient', avatar_url: null }], error: null }) }),
      insert: async (payload: unknown) => { mocks.insert(table, payload); return { error: null }; },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

describe('project sharing', () => {
  beforeEach(() => { mocks.insert.mockReset(); mocks.toastError.mockReset(); });

  it.each([
    { target: 'Recipient', table: 'messages' },
    { target: 'Team chat', table: 'group_chat_messages' },
  ])('includes the project ID in a share to $target', async ({ target, table }) => {
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ShareDialog open onOpenChange={vi.fn()} itemTitle="Project" itemType="Project" projectId="12000000-0000-4000-8000-000000000001" /></QueryClientProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: target }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
    const [actualTable, payload] = mocks.insert.mock.calls[0];
    expect(actualTable).toBe(table);
    expect(parseSharedItem((payload as { content: string }).content)?.project_id).toBe('12000000-0000-4000-8000-000000000001');
  });

  it('does not insert a project share when its ID is missing', async () => {
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ShareDialog open onOpenChange={vi.fn()} itemTitle="Project" itemType="Project" /></QueryClientProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Team chat' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('A valid project ID is required to share a project.'));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
