import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AffiliationRequestsManager from './AffiliationRequestsManager';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), update: vi.fn(), updateDone: vi.fn(), insert: vi.fn(),
  success: vi.fn(), error: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: () => ({
        order: async () => ({ data: [{
          id: 'request-1', user_id: 'requester-1', requested_name: 'Studio One',
          description_or_context: null, status: 'pending', admin_notes: null,
          reviewed_by: null, reviewed_at: null, created_at: '2026-01-01T00:00:00Z',
        }], error: null }),
        in: async () => ({ data: [{ user_id: 'requester-1', display_name: 'Artist', avatar_url: null }], error: null }),
      }),
      insert: async (payload: unknown) => { mocks.insert(table, payload); return { error: null }; },
      update: (payload: unknown) => {
        mocks.update(table, payload);
        return { eq: async (column: string, value: string) => {
          mocks.updateDone(column, value);
          return { error: null };
        } };
      },
    }),
  },
}));

const renderManager = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><AffiliationRequestsManager /></QueryClientProvider>);
  return invalidate;
};

beforeEach(() => {
  mocks.rpc.mockReset(); mocks.update.mockReset(); mocks.updateDone.mockReset(); mocks.insert.mockReset();
  mocks.success.mockReset(); mocks.error.mockReset();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('affiliation review notification', () => {
  it.each([
    ['approve', '', 'approved', null, 'Affiliation approved and added'],
    ['deny', 'Reason', 'denied', 'Reason', 'Request denied'],
  ])('%s sends the reviewed request after its update', async (action, notes, status, expectedNotes, message) => {
    const invalidate = renderManager();
    fireEvent.click(await screen.findByRole('button', { name: action === 'approve' ? 'Approve' : 'Deny' }));
    const dialog = screen.getByRole('dialog');
    if (notes) fireEvent.change(within(dialog).getByLabelText('Admin notes (optional)'), { target: { value: notes } });
    fireEvent.click(within(dialog).getByRole('button', { name: action === 'approve' ? 'Approve & Add' : 'Deny' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(message));
    expect(mocks.update).toHaveBeenCalledWith('affiliation_requests', {
      status, admin_notes: expectedNotes, reviewed_by: 'admin-1', reviewed_at: expect.any(String),
    });
    expect(mocks.updateDone).toHaveBeenCalledWith('id', 'request-1');
    expect(mocks.rpc).toHaveBeenCalledWith('notify_affiliation_reviewed', {
      p_user_id: 'requester-1', p_action: status, p_name: 'Studio One', p_notes: expectedNotes,
    });
    expect(mocks.updateDone.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['affiliation-requests'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['studios'] });
    if (action === 'approve') expect(mocks.insert).toHaveBeenCalledWith('studios', { name: 'Studio One', badge_tag: 'studioone' });
    else expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('continues through success when the resolved RPC response has an error', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('notification failed') });
    const invalidate = renderManager();
    fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Request denied'));
    expect(mocks.updateDone.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['affiliation-requests'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['studios'] });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('uses the failure path when the notification promise rejects', async () => {
    mocks.rpc.mockRejectedValue(new Error('notification rejected'));
    const invalidate = renderManager();
    fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deny' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('notification rejected'));
    expect(mocks.updateDone.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
