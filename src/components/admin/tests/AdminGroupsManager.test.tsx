import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminGroupsManager from '../AdminGroupsManager';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
const group = { id: 'group-id', name: 'School', slug: 'school', description: null, active_member_count: 0, active_admin_count: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
function renderManager() {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><AdminGroupsManager /></QueryClientProvider></MemoryRouter>);
}
function openCreate(emails: string) {
  fireEvent.click(screen.getByRole('button', { name: /new group/i }));
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'School' } });
  fireEvent.change(screen.getByLabelText(/admin emails/i), { target: { value: emails } });
  fireEvent.click(screen.getByRole('button', { name: /create group/i }));
}
describe('AdminGroupsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation(async (name: string) => name === 'admin_list_groups' ? { data: [group], error: null } : { data: null, error: null });
  });
  it('shows each committed assignment, invalid entry, duplicate and delivery failure', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'admin_list_groups' ? { data: [group], error: null } : { data: { group, results: [
      { email: 'active@example.edu', outcome: 'assigned', status: 'active' },
      { email: 'pending@example.edu', outcome: 'assigned', status: 'pending' },
      { email: 'bad', outcome: 'invalid' }, { email: 'pending@example.edu', outcome: 'duplicate' },
      { email: 'fail@example.edu', outcome: 'failed', error: 'Assignment failed' },
    ] }, error: null });
    mocks.invoke.mockResolvedValue({ data: { invite: { status: 'pending' }, email: { sent: false } }, error: null });
    renderManager(); await screen.findByText('School');
    openCreate('active@example.edu, pending@example.edu, bad, pending@example.edu, fail@example.edu');
    expect(await screen.findByText(/pending@example.edu: Assignment pending — Invitation email failed/i)).toBeInTheDocument();
    expect(screen.getByText(/bad: invalid/i)).toBeInTheDocument();
    expect(screen.getByText(/pending@example.edu: duplicate/i)).toBeInTheDocument();
    expect(screen.getByText(/fail@example.edu: failed/i)).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it('reports a no-valid-address rejection', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'admin_list_groups' ? { data: [group], error: null } : { data: null, error: { message: 'At least one valid admin email is required' } });
    renderManager(); await screen.findByText('School'); openCreate('invalid');
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('At least one valid admin email is required'));
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('adds from the platform group list and reports unknown transport outcome', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'network' } });
    renderManager(); await screen.findByText('School');
    fireEvent.click(screen.getByRole('button', { name: /^add admin$/i }));
    fireEvent.change(screen.getByLabelText(/^admin email$/i), { target: { value: 'person@example.edu' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^add admin$/i }));
    expect(await screen.findByText(/assignment and delivery outcomes unknown/i)).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith('send-group-admin-invite', expect.objectContaining({ body: expect.objectContaining({ groupId: 'group-id' }) }));
  });
  it('uses the latest active status when a pending recipient confirms before delivery', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'admin_list_groups' ? { data: [group], error: null } : { data: { group, results: [{ email: 'person@example.edu', outcome: 'assigned', status: 'pending' }] }, error: null });
    mocks.invoke.mockResolvedValue({ data: { invite: { status: 'active' }, email: { sent: false, notRequired: true } }, error: null });
    renderManager(); await screen.findByText('School'); openCreate('person@example.edu');
    expect(await screen.findByText(/person@example.edu: Assignment active — Email not required/i)).toBeInTheDocument();
  });
  it('shows the group-list loading error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Admin only' } });
    renderManager();
    expect(await screen.findByText('Admin only')).toBeInTheDocument();
  });
  it('explains a duplicate group slug', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'admin_list_groups'
      ? { data: [group], error: null }
      : { data: null, error: { code: '23505', message: 'duplicate key groups_slug_key' } });
    renderManager(); await screen.findByText('School'); openCreate('person@example.edu');
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('That group URL slug is already in use. Choose a different slug.'));
  });
});
