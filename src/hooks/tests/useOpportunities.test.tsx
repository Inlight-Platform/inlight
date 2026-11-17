import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOpportunities } from '../useOpportunities';

const mock = vi.hoisted(() => ({
  user: null as null | { id: string },
  queryFn: undefined as undefined | (() => Promise<unknown>),
  calls: [] as Array<[string, string, ...unknown[]]>,
  responses: {} as Record<string, unknown>,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('@/hooks/useFeatureAccess', () => ({ useFeatureAccess: () => ({ canManageJobs: false }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: vi.fn(),
  useQuery: (options: { queryFn: () => Promise<unknown> }) => { mock.queryFn = options.queryFn; return {}; },
  useMutation: () => ({}),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let filter = 'canonical';
      const chain = {
        select: (fields: string) => { mock.calls.push([table, 'select', fields]); return chain; },
        order: (field: string, options: unknown) => { mock.calls.push([table, 'order', field, options]); return chain; },
        like: (field: string, value: string) => { filter = 'marked'; mock.calls.push([table, 'like', field, value]); return chain; },
        not: (field: string, operator: string, value: unknown) => { filter = 'linked'; mock.calls.push([table, 'not', field, operator, value]); return chain; },
        then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
          const value = mock.responses[`${table}:${filter}`];
          if (value instanceof Promise) return value.then(resolve, reject);
          return Promise.resolve(value ?? { data: [], error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  },
}));

const publicRow = {
  id: 'public-id', title: 'Public job', description: '', type: 'job', status: 'open', posted_by: null,
  company: null, location: null, is_remote: false, compensation: null, experience_level: 'any',
  roles: null, requirements: null, deadline: null, start_date: null, duration: null, tags: null,
  is_featured: false, action_type: null, image_url: null, link_url: null, link_title: null,
  is_public: false, created_at: '2026-01-01T00:00:00Z', updated_at: null,
};
const post = { id: 'post-id', content: '🎯 **Feed job**', image_url: null, link_url: 'https://example.org/job', link_title: null, created_at: '2026-01-02T00:00:00Z' };

beforeEach(() => { mock.user = null; mock.calls = []; mock.responses = {}; mock.queryFn = undefined; });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const load = () => {
  renderHook(() => useOpportunities());
  if (!mock.queryFn) throw new Error('Opportunity query was not registered');
  return mock.queryFn();
};

describe('useOpportunities query', () => {
  it.each([
    { signedIn: false, canonical: 'opportunities_public_browse', posts: 'posts_public_browse', fields: 'id, content, image_url, link_url, link_title, created_at' },
    { signedIn: true, canonical: 'opportunities', posts: 'posts', fields: 'id, user_id, content, image_url, link_url, link_title, created_at' },
  ])('uses the correct sources and fields when signedIn=$signedIn', async ({ signedIn, canonical, posts, fields }) => {
    mock.user = signedIn ? { id: 'viewer' } : null;
    mock.responses[`${canonical}:canonical`] = { data: [{ ...publicRow, posted_by: signedIn ? 'owner' : null }], error: null };
    mock.responses[`${posts}:marked`] = { data: [post], error: null };
    mock.responses[`${posts}:linked`] = { data: [post], error: null };
    const result = await load();
    expect(mock.calls.filter(([table, action]) => table === canonical && action === 'select')).toEqual([[canonical, 'select', '*']]);
    expect(mock.calls.filter(([table, action]) => table === posts && action === 'select')).toEqual([[posts, 'select', fields], [posts, 'select', fields]]);
    expect(mock.calls).toContainEqual([posts, 'like', 'content', '🎯%']);
    expect(mock.calls).toContainEqual([posts, 'not', 'link_url', 'is', null]);
    expect(mock.calls.filter(([, action]) => action === 'order')).toEqual([[canonical, 'order', 'created_at', { ascending: false }], [posts, 'order', 'created_at', { ascending: false }], [posts, 'order', 'created_at', { ascending: false }]]);
    expect(result).toEqual([expect.objectContaining({ id: 'post-id', title: 'Feed job' }), expect.objectContaining({ id: 'public-id', postedBy: signedIn ? 'owner' : '' })]);
  });

  it.each(['title', 'description', 'type', 'status', 'is_remote', 'experience_level', 'is_featured', 'created_at'])('skips a public row with null %s and keeps valid data', async (field) => {
    mock.responses['opportunities_public_browse:canonical'] = { data: [{ ...publicRow, id: 'invalid', [field]: null }, publicRow], error: null };
    expect(await load()).toEqual([expect.objectContaining({ id: 'public-id', description: '', isRemote: false, isFeatured: false, roles: [], requirements: [], tags: [], skills: [], location: 'Remote', actionType: 'apply' })]);
  });

  it('keeps a sanitized empty title and description, false values, and existing defaults', async () => {
    mock.responses['opportunities_public_browse:canonical'] = { data: [{ ...publicRow, title: '' }], error: null };
    expect(await load()).toEqual([expect.objectContaining({ title: '', description: '', isRemote: false, isFeatured: false, skills: [], roles: [], location: 'Remote', actionType: 'apply' })]);
  });

  it('continues with both feed queries after a canonical rejection and deduplicates by URL', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mock.responses['opportunities_public_browse:canonical'] = Promise.reject(new Error('unavailable'));
    mock.responses['posts_public_browse:marked'] = { data: [post], error: null };
    mock.responses['posts_public_browse:linked'] = { data: [{ ...post, id: 'second' }], error: null };
    expect(await load()).toEqual([expect.objectContaining({ id: 'post-id' })]);
    expect(warning).toHaveBeenCalledWith('Canonical opportunities failed to load; showing public feed jobs only.', expect.any(Error));
  });

  it('times out a stalled canonical query and clears timers after completion', async () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mock.responses['opportunities_public_browse:canonical'] = new Promise(() => undefined);
    mock.responses['posts_public_browse:linked'] = { data: [post], error: null };
    const result = load();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await result).toEqual([expect.objectContaining({ id: 'post-id' })]);
    expect(warning).toHaveBeenCalledWith('Canonical opportunities failed to load; showing public feed jobs only.', expect.objectContaining({ message: 'Loading opportunities timed out' }));
    expect(clear).toHaveBeenCalled();
  });
});
