import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRows = vi.hoisted(() => ({
  projectRoles: [] as Array<{ id: string; role_name: string; assigned_user_id: string | null; project_id: string }>,
  projectInvitations: [] as Array<{ project_role_id: string; receiver_id: string; status: string }>,
  projectMembers: [] as Array<{ user_id: string; role: string | null }>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'member_b' }, loading: false }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const rowsForTable = () => {
        if (table === 'projects') return [{ title: 'Test' }];
        if (table === 'project_roles') return mockRows.projectRoles;
        if (table === 'project_invitations') return mockRows.projectInvitations;
        if (table === 'project_members') return mockRows.projectMembers;
        if (table === 'role_applications') return [];
        return [];
      };

      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(async () => ({ data: rowsForTable(), error: null })),
        order: vi.fn(async () => ({ data: rowsForTable(), error: null })),
        single: vi.fn(async () => ({ data: rowsForTable()[0] || null, error: null })),
        maybeSingle: vi.fn(async () => ({ data: rowsForTable()[0] || null, error: null })),
        insert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => chain),
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
          resolve({ data: rowsForTable(), error: null }),
      };

      return chain;
    },
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/resume.pdf' } })),
      }),
    },
  },
}));

const renderOpenRoles = async ({ isProjectMember = true } = {}) => {
  const { OpenRolesDisplay } = await import('@/components/projects/OpenRolesDisplay');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <OpenRolesDisplay projectId="project_123" creatorId="creator" isProjectMember={isProjectMember} />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('OpenRolesDisplay', () => {
  beforeEach(() => {
    mockRows.projectRoles = [];
    mockRows.projectInvitations = [];
    mockRows.projectMembers = [];
  });

  it('shows role filled to a third member when the accepted invitation row is hidden by RLS', async () => {
    mockRows.projectRoles = [
      {
        id: 'role_director',
        role_name: 'Director',
        assigned_user_id: 'invitee_a',
        project_id: 'project_123',
      },
    ];
    mockRows.projectInvitations = [];
    mockRows.projectMembers = [
      {
        user_id: 'invitee_a',
        role: 'Director',
      },
    ];

    await renderOpenRoles();

    expect(await screen.findByText('Role filled')).toBeInTheDocument();
    expect(screen.queryByText('Invitation pending')).not.toBeInTheDocument();
  });

  it('hides assigned pending roles from non-members and only shows roles that are still open', async () => {
    mockRows.projectRoles = [
      {
        id: 'role_director',
        role_name: 'Director',
        assigned_user_id: 'invitee_a',
        project_id: 'project_123',
      },
      {
        id: 'role_gaffer',
        role_name: 'Gaffer',
        assigned_user_id: null,
        project_id: 'project_123',
      },
    ];
    mockRows.projectInvitations = [
      {
        project_role_id: 'role_director',
        receiver_id: 'invitee_a',
        status: 'pending',
      },
    ];
    mockRows.projectMembers = [];

    await renderOpenRoles({ isProjectMember: false });

    expect(await screen.findByText('Gaffer')).toBeInTheDocument();
    expect(screen.getByText(/Interested in joining\? Apply to an open role now\./i)).toBeInTheDocument();
    expect(screen.queryByText('Director')).not.toBeInTheDocument();
    expect(screen.queryByText('Invitation pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Role filled')).not.toBeInTheDocument();
  });

  it('shows a friendly empty state when no roles are visible to the viewer', async () => {
    mockRows.projectRoles = [
      {
        id: 'role_director',
        role_name: 'Director',
        assigned_user_id: 'invitee_a',
        project_id: 'project_123',
      },
    ];
    mockRows.projectInvitations = [
      {
        project_role_id: 'role_director',
        receiver_id: 'invitee_a',
        status: 'pending',
      },
    ];
    mockRows.projectMembers = [];

    await renderOpenRoles({ isProjectMember: false });

    expect(await screen.findByText('No open roles in Test Project. Check back soon.')).toBeInTheDocument();
    expect(screen.queryByText('Director')).not.toBeInTheDocument();
    expect(screen.queryByText('Invitation pending')).not.toBeInTheDocument();
  });
});
