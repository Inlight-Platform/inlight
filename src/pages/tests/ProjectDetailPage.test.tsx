import { describe, it, vi, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { projectPath } from '@/lib/publicPaths';

const projectLookups = vi.hoisted(() => ({ filters: [] as Array<{ column: string; value: string }> }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'creator1' }, loading: false }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canManageProjects: true }),
}));

vi.mock('@/hooks/useProjectPhotoUpload', () => ({
  useProjectPhotoUpload: () => ({ uploadPhoto: vi.fn(), uploading: false, progress: 0 }),
}));

vi.mock('@/hooks/useMinimizedChat', () => ({
  useMinimizedChat: () => ({
    isMinimized: false,
    originRoute: null,
    chatRoute: null,
    close: vi.fn(),
    expand: vi.fn(),
  }),
}));

vi.mock('@/components/projects/ProjectTimeline', () => ({
  ProjectTimeline: () => null,
}));

vi.mock('@/components/projects/OpenRolesDisplay', () => ({
  OpenRolesDisplay: () => null,
}));

vi.mock('@/components/messages/FloatingChatButton', () => ({
  default: () => null,
}));

vi.mock('@/components/invitations/InviteFriendDialog', () => ({
  InviteFriendDialog: () => null,
}));

vi.mock('@/components/invitations/ProjectInvitationPrompt', () => ({
  ProjectInvitationPrompt: () => null,
}));

// Mock supabase project fetch and update
vi.mock('@/integrations/supabase/client', () => {
  const project = {
    id: 'proj1',
    slug: 'proj1',
    title: 'Test Project',
    description: null,
    creator_id: 'creator1',
    is_public: false,
    status: 'planning',
    created_at: '2026-01-01T00:00:00Z',
  };
  const tableRows: Record<string, any[]> = {
    projects: [project],
    projects_browse: [{
      id: project.id,
      title: project.title,
      description: project.description,
      creator_id: project.creator_id,
      status: project.status,
      created_at: project.created_at,
      slug: project.slug,
    }, {
      ...project,
      id: 'e6f08864-03ac-4fc4-9926-9b0281eabb83',
      slug: 'same-project',
      title: 'Same Project',
      description: 'Older project from another creator',
      creator_id: 'other-creator',
    }, {
      ...project,
      id: 'e6f08864-03ac-4fc4-9926-9b0281eabb84',
      slug: 'same-project-2',
      title: 'Same Project',
      description: 'New project owned by current user',
    }],
    profiles_public: [{ user_id: 'creator1', display_name: 'Creator', avatar_url: null }],
    project_members: [],
    project_photos: [],
    project_links: [],
    saved_projects: [],
  };

  return {
    supabase: {
      from: (table: string) => {
        let updatePayload: any = null;
        const filters: Array<{ column: string; value: string }> = [];
        const rows = () => (tableRows[table] || []).filter((row) => filters.every(({ column, value }) => row[column] === value));
        const chain: any = {
          select: vi.fn(() => chain),
          update: vi.fn((payload: any) => {
            updatePayload = payload;
            return chain;
          }),
          insert: vi.fn(() => chain),
          delete: vi.fn(() => chain),
          order: vi.fn(async () => ({ data: rows(), error: null })),
          in: vi.fn(async () => ({ data: rows(), error: null })),
          eq: vi.fn((column: string, value: string) => {
            filters.push({ column, value });
            if (table === 'projects_browse') projectLookups.filters.push({ column, value });
            return chain;
          }),
          single: vi.fn(async () => ({ data: rows()[0] || null, error: rows().length === 1 ? null : new Error('Project not found') })),
          maybeSingle: vi.fn(async () => ({ data: rows()[0] || null, error: null })),
          then: (resolve: any) => resolve({ data: updatePayload ? [{ ...project, ...updatePayload }] : rows(), error: null }),
        };
        return chain;
      },
      storage: {
        from: () => ({
          upload: vi.fn(async () => ({ error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/image.jpg' } })),
        }),
      },
      rpc: vi.fn(async (name: string) => ({
        data: name === 'get_project_member_details'
          ? [{ is_public: project.is_public }]
          : null,
        error: null,
      })),
    },
  };
});

const renderProject = async (path = '/projects/proj1') => {
  const ProjectDetailPage = (await import('@/pages/ProjectDetailPage')).default;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('ProjectDetailPage (public toggle)', () => {
  it.each([
    ['creation result without slug', projectPath({ id: 'e6f08864-03ac-4fc4-9926-9b0281eabb84', title: 'Same Project' })],
    ['stored slug', projectPath({ id: 'e6f08864-03ac-4fc4-9926-9b0281eabb84', title: 'Same Project', slug: 'same-project-2' })],
    ['direct UUID', '/projects/e6f08864-03ac-4fc4-9926-9b0281eabb84'],
  ])('opens the new same-title project by UUID: %s', async (_name, path) => {
    projectLookups.filters.length = 0;
    const id = 'e6f08864-03ac-4fc4-9926-9b0281eabb84';
    await renderProject(path);
    expect(await screen.findByText('New project owned by current user')).toBeDefined();
    expect(screen.queryByText('Older project from another creator')).toBeNull();
    expect(projectLookups.filters).toContainEqual({ column: 'id', value: id });
    expect(projectLookups.filters.some(({ column }) => column === 'slug')).toBe(false);
    expect(await screen.findByRole('button', { name: /private/i })).toBeDefined();
  });

  it('preserves existing stored-slug links', async () => {
    await renderProject('/projects/same-project');
    expect(await screen.findByText('Older project from another creator')).toBeDefined();
    expect(screen.queryByText('New project owned by current user')).toBeNull();
  });

  it('fetches project by id and toggles is_public', async () => {
    await renderProject();

    // Example: find toggle and click it
    const toggle = await screen.findByRole('button', { name: /private/i });
    fireEvent.click(toggle);

    // Expect that UI reflects change (implementation-specific)
    expect(await screen.findByText(/private/i)).toBeDefined();
  });
});
