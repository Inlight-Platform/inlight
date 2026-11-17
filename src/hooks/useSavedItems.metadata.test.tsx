import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/integrations/supabase/types';
import { useSavedItems } from './useSavedItems';
import type { SaveItemInput } from './useSavedItems';

type SavedPayload = {
  user_id: string; item_type: string; item_id: string | null; item_title: string; item_url: string;
  item_metadata: Record<string, Json | undefined>;
};
const mocks = vi.hoisted(() => ({
  upsert: vi.fn<[SavedPayload, { onConflict: string; ignoreDuplicates: boolean }], Promise<{ error: null }>>(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'saved_items') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
        upsert: mocks.upsert,
      };
    },
  },
}));

beforeEach(() => {
  mocks.upsert.mockReset();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.success.mockReset();
  mocks.error.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const save = async (input: SaveItemInput, expected: SavedPayload) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useSavedItems(), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  await waitFor(() => expect(client.getQueryState(['saved-items', 'synthetic-user'])?.status).toBe('success'));
  invalidate.mockClear();
  act(() => result.current.saveItem(input));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Saved!'));
  expect(mocks.upsert).toHaveBeenCalledTimes(1);
  expect(mocks.upsert).toHaveBeenCalledWith(expected, { onConflict: 'user_id,item_type,item_title,item_url', ignoreDuplicates: true });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['saved-items'] });
  expect(mocks.error).not.toHaveBeenCalled();
};

describe('saved-item metadata input', () => {
  it('passes resource metadata to the upsert', async () => {
    const metadata = { description: 'Synthetic resource', category: 'education' };
    await save({ item_type: 'resource', item_title: 'Resource', item_url: 'https://example.test/resource', item_metadata: metadata }, {
      user_id: 'synthetic-user', item_type: 'resource', item_id: null, item_title: 'Resource', item_url: 'https://example.test/resource', item_metadata: metadata,
    });
  });

  it('passes job metadata including a null and an explicitly undefined field', async () => {
    const metadata = { company: 'Synthetic Company', type: 'job', description: 'Synthetic role', image_url: null, deadline: undefined };
    await save({ item_type: 'job', item_id: 'job-1', item_title: 'Job', item_metadata: metadata }, {
      user_id: 'synthetic-user', item_type: 'job', item_id: 'job-1', item_title: 'Job', item_url: '', item_metadata: metadata,
    });
    const payload = mocks.upsert.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(payload.item_metadata, 'deadline')).toBe(true);
    expect(payload.item_metadata.deadline).toBeUndefined();
    expect(payload.item_metadata.image_url).toBeNull();
  });

  it('passes open-role project metadata to the upsert', async () => {
    const metadata = { projectTitle: 'Synthetic Project', projectId: 'project-1', deadline: null };
    await save({ item_type: 'open_role', item_id: 'role-1', item_title: 'Role', item_url: 'role-1', item_metadata: metadata }, {
      user_id: 'synthetic-user', item_type: 'open_role', item_id: 'role-1', item_title: 'Role', item_url: 'role-1', item_metadata: metadata,
    });
  });

  it('passes person metadata including the match flag to the upsert', async () => {
    const metadata = { headline: 'Synthetic artist', avatar_url: null, location: 'Chicago', bio: 'Synthetic bio', match: true };
    await save({ item_type: 'person', item_id: 'person-1', item_title: 'Person', item_url: '/profile/person-1', item_metadata: metadata }, {
      user_id: 'synthetic-user', item_type: 'person', item_id: 'person-1', item_title: 'Person', item_url: '/profile/person-1', item_metadata: metadata,
    });
  });
});
