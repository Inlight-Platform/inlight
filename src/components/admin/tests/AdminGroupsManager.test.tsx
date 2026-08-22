import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminGroupsManager from '../AdminGroupsManager';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

const renderManager = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AdminGroupsManager />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('AdminGroupsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a department portal with an initial admin and refreshes the groups list', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            id: 'strasberg-id',
            slug: 'strasberg',
            name: 'Strasberg',
            description: 'A private space for the Strasberg cohort and faculty.',
            active_member_count: 2,
            active_admin_count: 1,
            created_at: '2026-08-01T12:00:00.000Z',
            updated_at: '2026-08-01T12:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'adler-id',
          slug: 'stella-adler',
          name: 'Stella Adler Studio',
          description: 'A private space for Adler students.',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'adler-id',
            slug: 'stella-adler',
            name: 'Stella Adler',
            description: 'A private space for Adler students.',
            active_member_count: 0,
            active_admin_count: 1,
            created_at: '2026-08-21T12:00:00.000Z',
            updated_at: '2026-08-21T12:00:00.000Z',
          },
        ],
        error: null,
      });

    renderManager();

    expect(await screen.findByText('Strasberg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new group/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Stella Adler' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A private space for Adler students.' },
    });
    fireEvent.change(screen.getByLabelText(/initial admin email/i), {
      target: { value: 'Ryan@Adler.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('admin_create_group', {
        _name: 'Stella Adler',
        _slug: 'stella-adler',
        _description: 'A private space for Adler students.',
        _initial_admin_email: 'ryan@adler.edu',
      });
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith('Department portal created');
    expect(await screen.findByText('Stella Adler')).toBeInTheDocument();
    expect(screen.getByText('/stella-adler')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows an error state when groups cannot be loaded', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Admin only' },
    });

    renderManager();

    expect(await screen.findByText('Admin only')).toBeInTheDocument();
  });

  it('shows a friendly toast when a group slug already exists', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            id: 'adler-id',
            slug: 'stella-adler',
            name: 'Stella Adler',
            description: 'A private space for Adler students.',
            active_member_count: 0,
            active_admin_count: 1,
            created_at: '2026-08-21T12:00:00.000Z',
            updated_at: '2026-08-21T12:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "groups_slug_key"',
        },
      });

    renderManager();

    expect(await screen.findByText('Stella Adler')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new group/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Stella Adler' },
    });
    fireEvent.change(screen.getByLabelText(/initial admin email/i), {
      target: { value: 'admin@adler.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'That group URL slug is already in use. Choose a different slug.',
      );
    });
  });
});
