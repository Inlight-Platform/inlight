import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRolesFeed } from '../OpenRolesFeed';

const state = vi.hoisted(() => ({
  rows: new Array<Record<string, unknown>>(),
  errors: new Map<string, Error>(),
  from: vi.fn(), select: vi.fn(), order: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useSavedItems', () => ({ useSavedItems: () => ({ isSaved: () => false, toggleSave: vi.fn() }) }));
vi.mock('@/components/auth/VisitorAuthPrompt', () => ({ VisitorAuthPrompt: () => null }));
vi.mock('@/components/opportunities/ApplicationDialog', () => ({ default: () => null }));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      state.from(table);
      const chain = {
        select: (fields: string) => { state.select(table, fields); return chain; },
        order: async (column: string, options: unknown) => {
          state.order(table, column, options);
          const error = state.errors.get(table) || null;
          return { data: error ? null : state.rows, error };
        },
      };
      return chain;
    },
  },
}));

const validRole = () => ({
  id: 'role-1', role_name: 'Synthetic Director', project_id: 'project-1',
  project_title: 'Synthetic Project', project_deadline: null, created_at: '2099-01-01T12:00:00',
});
const renderFeed = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><OpenRolesFeed /></QueryClientProvider></MemoryRouter>);
  return client;
};
const waitForQuery = async (client: QueryClient, status: 'success' | 'error') => {
  await waitFor(() => expect(client.getQueryState(['open-roles-feed', undefined])?.status).toBe(status));
};

beforeEach(() => {
  state.rows = []; state.errors.clear();
  state.from.mockReset(); state.select.mockReset(); state.order.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('public open roles', () => {
  it('renders a public role and the existing created-date fallback for a null deadline', async () => {
    state.rows = [validRole()];
    const client = renderFeed();
    await waitForQuery(client, 'success');
    expect(screen.getByText('Synthetic Director')).toBeTruthy();
    expect(screen.getByText('Synthetic Project')).toBeTruthy();
    expect(screen.getByText('Apply by Feb 1, 2099')).toBeTruthy();
    expect(state.from).toHaveBeenCalledWith('project_roles_public_browse');
    expect(state.select).toHaveBeenCalledWith('project_roles_public_browse', 'id, role_name, project_id, project_title, project_deadline, created_at');
    expect(state.order).toHaveBeenCalledWith('project_roles_public_browse', 'created_at', { ascending: false });
  });

  it('renders the settled empty state for no public rows', async () => {
    const client = renderFeed();
    await waitForQuery(client, 'success');
    expect(screen.getByText('No open roles right now')).toBeTruthy();
  });

  it('preserves the empty display after a returned query error', async () => {
    state.errors.set('project_roles_public_browse', new Error('Public roles unavailable'));
    const client = renderFeed();
    await waitForQuery(client, 'error');
    expect(screen.getByText('No open roles right now')).toBeTruthy();
  });

  it.each(['role_name', 'project_id', 'project_title', 'created_at'])(
    'hides a row with null %s while retaining a valid row', async (field) => {
      const incomplete: Record<string, unknown> = {
        ...validRole(), id: 'role-incomplete', role_name: 'Incomplete Role', project_title: 'Incomplete Project',
      };
      incomplete[field] = null;
      state.rows = [incomplete, validRole()];
      const client = renderFeed();
      await waitForQuery(client, 'success');
      expect(screen.getByText('Synthetic Director')).toBeTruthy();
      expect(screen.getByText('Synthetic Project')).toBeTruthy();
      expect(screen.queryByText('Incomplete Role')).toBeNull();
      expect(screen.queryByText('Incomplete Project')).toBeNull();
    },
  );
});
