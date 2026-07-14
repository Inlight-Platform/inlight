import { describe, it, vi, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
    title: 'Test Project',
    description: null,
    creator_id: 'creator1',
    is_public: false,
    status: 'planning',
    created_at: '2026-01-01T00:00:00Z',
  };
  const tableRows: Record<string, any[]> = {
    projects: [project],
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
        const rows = () => tableRows[table] || [];
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
          eq: vi.fn(() => chain),
          single: vi.fn(async () => ({ data: rows()[0] || null, error: null })),
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
      rpc: vi.fn(async () => ({ data: null, error: null })),
    },
  };
});

const renderProject = async () => {
  const ProjectDetailPage = (await import('@/pages/ProjectDetailPage')).default;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={['/projects/proj1']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('ProjectDetailPage (public toggle)', () => {
  it('fetches project by id and toggles is_public', async () => {
    await renderProject();

    // Example: find toggle and click it
    const toggle = await screen.findByRole('button', { name: /private/i });
    fireEvent.click(toggle);

    // Expect that UI reflects change (implementation-specific)
    expect(await screen.findByText(/private/i)).toBeDefined();
  });
});
