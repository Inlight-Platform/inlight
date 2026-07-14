import { describe, it, vi, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock supabase project fetch and update
vi.mock('@/integrations/supabase/client', () => {
  const project = { id: 'proj1', name: 'Test Project', is_public: false };
  return {
    supabase: {
      from: (table: string) => ({
        select: vi.fn(async (cols: string) => {
          if (table === 'projects') return { data: [project], error: null };
          return { data: [], error: null };
        }),
        update: vi.fn(async (payload: any) => ({ data: [{ ...project, ...payload }], error: null })),
        eq: vi.fn().mockReturnThis(),
      }),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    },
  };
});

describe('ProjectDetailPage (public toggle)', () => {
  it('fetches project by id and toggles is_public', async () => {
    const ProjectDetailPage = require('@/pages/ProjectDetailPage').default;
    render(ProjectDetailPage ? <ProjectDetailPage projectId="proj1" /> : null);

    // Example: find toggle and click it
    const toggle = await screen.findByRole('checkbox');
    fireEvent.click(toggle);

    // Expect that UI reflects change (implementation-specific)
    expect(await screen.findByText(/public/i)).toBeDefined();
  });
});
