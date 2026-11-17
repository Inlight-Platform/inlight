import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OpportunitiesPage from '../OpportunitiesPage';

const state = vi.hoisted(() => ({
  user: { id: 'owner' } as { id: string } | null,
  rows: [] as Array<{ id: string; project_role_id: string; project_id: string; role_name: string; project_title: string; message: string; reel_url: string | null; resume_url: string | null; status: string; created_at: string }>,
  error: null as Error | null,
  rpc: vi.fn(),
}));
vi.mock('@/lib/featureFlags', () => ({ JOBS_ENABLED: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useFeatureAccess', () => ({ useFeatureAccess: () => ({ canManageJobs: false, showRestrictedToast: vi.fn() }) }));
vi.mock('@/hooks/useOpportunities', () => ({ useOpportunities: () => ({ opportunities: [], isLoading: false, isError: false, deleteOpportunity: vi.fn() }) }));
vi.mock('@/components/projects/OpenRolesFeed', () => ({ OpenRolesFeed: () => null }));
vi.mock('@/components/opportunities/OpportunityFilters', () => ({ default: () => null }));
vi.mock('@/components/opportunities/OpportunityCreator', () => ({ default: () => null }));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({ default: () => null }));
vi.mock('@/components/opportunities/EditOpportunityDialog', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
    from: () => {
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: { data: never[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return chain;
    },
  },
}));

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={['/jobs']}><QueryClientProvider client={client}>
    <Routes><Route path="/jobs" element={<OpportunitiesPage />} /><Route path="/projects/:id" element={<p>Project destination</p>} /></Routes>
  </QueryClientProvider></MemoryRouter>);
  return client;
};
beforeEach(() => {
  state.user = { id: 'owner' }; state.rows = []; state.error = null; state.rpc.mockReset();
  state.rpc.mockImplementation(async () => ({ data: state.error ? null : state.rows, error: state.error }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('role applications', () => {
  it('does not call the RPC when signed out', async () => {
    state.user = null;
    renderPage();
    expect(await screen.findByText(/open jobs/i)).toBeTruthy();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('calls the no-argument RPC and renders an empty list', async () => {
    renderPage();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('get_my_role_applications_for_jobs'));
    fireEvent.mouseDown(screen.getByRole('tab', { name: /my applications/i }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('No job applications yet')).toBeTruthy();
  });

  it('sorts role applications, preserves nullable links, and opens the project', async () => {
    state.rows = [
      { id: 'old', project_role_id: 'role-old', project_id: 'project-old', role_name: 'Older Role', project_title: 'Old Project', message: '', reel_url: null, resume_url: null, status: 'pending', created_at: '2025-01-01T00:00:00Z' },
      { id: 'new', project_role_id: 'role-new', project_id: 'project-new', role_name: 'Newer Role', project_title: 'New Project', message: 'Hello', reel_url: 'https://example.test/reel', resume_url: 'https://example.test/resume', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
    ];
    renderPage();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('get_my_role_applications_for_jobs'));
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /my applications/i }), { button: 0, ctrlKey: false });
    const newer = await screen.findByText('Newer Role');
    const older = screen.getByText('Older Role');
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: /reel \/ portfolio/i }).getAttribute('href')).toBe('https://example.test/reel');
    expect(screen.getByRole('link', { name: /resume/i }).getAttribute('href')).toBe('https://example.test/resume');
    const card = older.closest('.rounded-lg');
    if (!(card instanceof HTMLElement)) throw new Error('Missing application card');
    expect(within(card).queryByRole('link', { name: /resume/i })).toBeNull();
    expect(within(card).queryByRole('link', { name: /reel/i })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: /view job/i }));
    expect(await screen.findByText('Project destination')).toBeTruthy();
  });

  it('records an RPC error without inventing an error display', async () => {
    state.error = new Error('role applications failed');
    const client = renderPage();
    await waitFor(() => expect(client.getQueryState(['my-role-job-applications', 'owner'])?.status).toBe('error'));
    expect(client.getQueryState(['my-role-job-applications', 'owner'])?.error).toBe(state.error);
  });
});
