import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationCard } from './InvitationCard';
import { ProjectInvitationPrompt } from './ProjectInvitationPrompt';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  credit: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'invitee' } }) }));
vi.mock('@/lib/projectInvitationCredits', () => ({ ensureAcceptedProjectCredit: mocks.credit }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: async () => ({
          data: [{ id: 'prompt-invite', project_role_id: 'role-1' }],
          error: null,
        }),
        then: (resolve: (value: { data: Array<{ id: string; role_name: string }>; error: null }) => unknown) =>
          Promise.resolve({ data: table === 'project_roles' ? [{ id: 'role-1', role_name: 'Director' }] : [], error: null }).then(resolve),
      };
      return chain;
    },
  },
}));

const invitation = {
  id: 'card-invite', status: 'pending', created_at: '2026-01-01T00:00:00Z',
  project_role: {
    id: 'role-1', role_name: 'Director',
    project: { id: 'project-1', title: 'Project One', main_image_url: null },
  },
  sender: { user_id: 'sender', display_name: 'Sender', avatar_url: null },
};

const Location = () => <div data-testid="route">{useLocation().pathname}</div>;

const renderInvitation = (component: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<MemoryRouter initialEntries={['/current']}><QueryClientProvider client={client}>
    {component}<Location />
  </QueryClientProvider></MemoryRouter>);
  return invalidate;
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.credit.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
  mocks.credit.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe.each([
  ['card', <InvitationCard invitation={invitation} />, 'card-invite', [
    ['my-invitations'], ['open-roles', 'project-1'], ['project-role-members', 'project-1'],
    ['project-members', 'project-1'], ['credits'],
  ]],
  ['prompt', <ProjectInvitationPrompt projectId="project-1" projectTitle="Project One" />, 'prompt-invite', [
    ['project-pending-invitation', 'project-1', 'invitee'], ['open-roles', 'project-1'],
    ['project-role-members', 'project-1'], ['project-role-invitations', 'project-1'],
    ['project-members', 'project-1'], ['my-invitations', 'invitee'], ['credits'],
  ]],
] as Array<[string, React.ReactElement, string, string[][]]>)('%s acceptance', (_label, component, id, keys) => {
  it('accepts before creating credit and preserves success effects', async () => {
    const invalidate = renderInvitation(component);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(mocks.credit).toHaveBeenCalledWith({
      userId: 'invitee', projectTitle: 'Project One', roleName: 'Director',
    }));
    expect(mocks.rpc).toHaveBeenCalledWith('accept_project_invitation', { _invitation_id: id });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.credit.mock.invocationCallOrder[0]);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('You\'ve joined "Project One" as Director!'));
    for (const queryKey of keys) expect(invalidate).toHaveBeenCalledWith({ queryKey });
    expect(screen.getByTestId('route').textContent).toBe('/current');
  });

  it('does not create credit after acceptance fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('accept failed') });
    const invalidate = renderInvitation(component);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Failed to accept invitation'));
    expect(mocks.rpc).toHaveBeenCalledWith('accept_project_invitation', { _invitation_id: id });
    expect(mocks.credit).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByTestId('route').textContent).toBe('/current');
  });
});
