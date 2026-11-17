import { beforeEach, describe, it, vi, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { projectPath } from '@/lib/publicPaths';

const projectLookups = vi.hoisted(() => ({
  filters: [] as Array<{ column: string; value: string }>,
  visibility: 'private',
  rpc: vi.fn(),
  projectUpdates: vi.fn(),
}));

beforeEach(() => {
  projectLookups.filters = [];
  projectLookups.visibility = 'private';
  projectLookups.rpc.mockClear();
  projectLookups.projectUpdates.mockClear();
});

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
    visibility: 'private',
    status: 'planning',
    created_at: '2026-01-01T00:00:00Z',
  };
  const tableRows: Record<string, Record<string, unknown>[]> = {
    projects: [project],
    projects_browse: [{
      id: project.id,
      title: project.title,
      description: project.description,
      creator_id: project.creator_id,
      status: project.status,
      created_at: project.created_at,
      slug: project.slug,
      visibility: project.visibility,
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
        let updatePayload: Record<string, unknown> | null = null;
        const filters: Array<{ column: string; value: string }> = [];
        const rows = () => (tableRows[table] || [])
          .filter((row) => filters.every(({ column, value }) => row[column] === value))
          .map((row) => table === 'projects_browse' && row.id === project.id
            ? { ...row, visibility: projectLookups.visibility }
            : row);
        type MockRow = Record<string, unknown>;
        type MockChain = {
          select: () => MockChain;
          update: (payload: MockRow) => MockChain;
          insert: () => MockChain;
          delete: () => MockChain;
          order: () => Promise<{ data: MockRow[]; error: null }>;
          in: () => Promise<{ data: MockRow[]; error: null }>;
          eq: (column: string, value: string) => MockChain;
          single: () => Promise<{ data: MockRow | null; error: Error | null }>;
          maybeSingle: () => Promise<{ data: MockRow | null; error: null }>;
          then: (resolve: (value: { data: MockRow[]; error: null }) => void) => void;
        };
        const chain: MockChain = {
          select: vi.fn(() => chain),
          update: vi.fn((payload: MockRow) => {
            if (table === 'projects') projectLookups.projectUpdates(payload);
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
          then: (resolve: (value: { data: MockRow[]; error: null }) => void) => resolve({ data: updatePayload ? [{ ...project, ...updatePayload }] : rows(), error: null }),
        };
        return chain;
      },
      storage: {
        from: () => ({
          upload: vi.fn(async () => ({ error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/image.jpg' } })),
        }),
      },
      rpc: projectLookups.rpc.mockImplementation(async (
        name: string,
        args?: { target_project_id?: string; target_audience?: string },
      ) => {
        if (name === 'set_project_audience' && args?.target_project_id === project.id && args.target_audience === 'public') {
          projectLookups.visibility = 'public';
        }
        return {
          data: name === 'get_project_member_details'
            ? [{ is_public: projectLookups.visibility === 'public' }]
            : null,
          error: null,
        };
      }),
    },
  };
});

const renderProject = async (path = '/projects/proj1') => {
  const ProjectDetailPage = (await import('@/pages/ProjectDetailPage')).default;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const rendered = render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...rendered, queryClient };
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

  it('fetches the project and saves a public audience', async () => {
    const { queryClient } = await renderProject();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    try {
      const audience = await screen.findByRole('button', { name: /^private$/i });
      fireEvent.keyDown(audience, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('menuitem', { name: /everyone/i }));

      await waitFor(() => expect(projectLookups.rpc).toHaveBeenCalledWith(
        'set_project_audience',
        {
          target_project_id: 'proj1',
          target_audience: 'public',
          target_group_id: null,
          target_recipient_ids: [],
        },
      ));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['project', 'proj1'],
      }));
      expect(await screen.findByRole('button', { name: /^everyone$/i })).toBeDefined();
      expect(projectLookups.projectUpdates).not.toHaveBeenCalled();
    } finally {
      invalidate.mockRestore();
    }
  });
});
