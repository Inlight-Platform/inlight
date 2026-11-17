import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedShows } from '../useSavedShows';

const mocks = vi.hoisted(() => ({
  user: { id: 'owner' } as { id: string } | null,
  rpc: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [{ show_id: 'show-1' }, { show_id: 'show-2' }], error: null }),
      }),
    }),
  },
}));

const deferred = () => {
  let resolve: (value: { error: Error | null }) => void = () => { throw new Error('RPC not started'); };
  const promise = new Promise<{ error: Error | null }>((complete) => { resolve = complete; });
  return { promise, resolve };
};

const renderSavedShows = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const hook = renderHook(() => useSavedShows(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  return { client, invalidate, ...hook };
};

beforeEach(() => {
  mocks.user = { id: 'owner' };
  mocks.rpc.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useSavedShows unsave', () => {
  it('removes the ID optimistically, then invalidates both queries on success', async () => {
    const pending = deferred();
    mocks.rpc.mockReturnValue(pending.promise);
    const { result, client, invalidate } = renderSavedShows();
    await waitFor(() => expect(result.current.savedShowIds).toEqual(['show-1', 'show-2']));
    act(() => result.current.unsaveShow('show-1'));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('remove_saved_show', { p_show_id: 'show-1' }));
    expect(client.getQueryData(['saved-show-ids', 'owner'])).toEqual(['show-2']);
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ error: null }); });
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Removed from your show list'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['saved-show-ids'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-saved-shows'] });
  });

  it('restores the prior cache and shows the existing error on failure', async () => {
    const pending = deferred();
    mocks.rpc.mockReturnValue(pending.promise);
    const { result, client } = renderSavedShows();
    await waitFor(() => expect(result.current.savedShowIds).toEqual(['show-1', 'show-2']));
    act(() => result.current.unsaveShow('show-1'));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('remove_saved_show', { p_show_id: 'show-1' }));
    expect(client.getQueryData(['saved-show-ids', 'owner'])).toEqual(['show-2']);
    await act(async () => { pending.resolve({ error: new Error('failed') }); });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Could not remove show'));
    expect(client.getQueryData(['saved-show-ids', 'owner'])).toEqual(['show-1', 'show-2']);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('does not call the RPC when unauthenticated', async () => {
    mocks.user = null;
    const { result } = renderSavedShows();
    act(() => result.current.unsaveShow('show-1'));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Could not remove show'));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
