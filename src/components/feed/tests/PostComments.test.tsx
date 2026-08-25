import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PostComments } from '../PostComments';

const insertedRows: { table: string; payload: unknown }[] = [];

let commentsData: unknown[] = [];
let profilesData: unknown[] = [];
let commentsOrder: { column: string; ascending: boolean } | null = null;
let postGroupsData: unknown[] = [];
let myGroupsData: { id: string; slug: string; name: string; is_faculty: boolean }[] = [];

const makeProxy = (table: string) => {
  const result = () => {
    if (table === 'post_comments') {
      const rows = [...commentsData];
      if (commentsOrder?.column === 'created_at') {
        rows.sort((a, b) => {
          const diff =
            new Date((a as { created_at: string }).created_at).getTime() -
            new Date((b as { created_at: string }).created_at).getTime();
          return commentsOrder?.ascending ? diff : -diff;
  it('shows delete controls when the current user is group faculty for the post', async () => {
    commentsData = [
      { id: 'c1', post_id: 'p1', user_id: 'u2', content: 'Another user', created_at: '2026-08-01T10:00:00Z' },
      { id: 'c2', post_id: 'p1', user_id: 'user-me', content: 'Mine', created_at: '2026-08-02T10:00:00Z' },
    ];
    profilesData = [
      { user_id: 'u2', display_name: 'alice', avatar_url: null },
      { user_id: 'user-me', display_name: null, avatar_url: null },
    ];
    postGroupsData = [{ group_id: 'group-1' }];
    myGroupsData = [{ id: 'group-1', slug: 'g', name: 'G', is_faculty: true }];

    renderComments();

    const deleteButtons = await screen.findAllByRole('button', { name: /delete comment/i });
    expect(deleteButtons).toHaveLength(2);
  });
});
      }
      return { data: rows, error: null };
    }
    if (table === 'profiles_public') return { data: profilesData, error: null };
    if (table === 'post_groups') return { data: postGroupsData, error: null };
    return { data: [], error: null };
  };

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(result()).then(onFulfilled);
      }
      if (prop === 'catch' || prop === 'finally') {
        return (onSettled: (value?: unknown) => unknown) =>
          Promise.resolve(result())[prop as 'catch'](onSettled);
      }
      if (prop === 'insert') {
        return (payload: unknown) => {
          insertedRows.push({ table, payload });
          return proxy;
        };
      }
      if (prop === 'order' && table === 'post_comments') {
        return (column: string, options?: { ascending?: boolean }) => {
          commentsOrder = { column, ascending: options?.ascending ?? true };
          return proxy;
        };
      }
      if (prop === 'eq' && table === 'post_groups') {
        return (_col: string, _val: unknown) => proxy;
      }
      return () => proxy;
    },
  };
  const proxy = new Proxy({}, handler);
  return proxy;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeProxy(table),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-me', email: 'me@test.dev' } }),
}));

vi.mock('@/hooks/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: false, isLoading: false }),
}));

vi.mock('@/hooks/useGroups', () => ({
  useMyGroups: () => ({ data: myGroupsData, isLoading: false }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const renderComments = (props?: Partial<React.ComponentProps<typeof PostComments>>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PostComments postId="p1" postOwnerId="owner-1" {...props} />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('PostComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedRows.length = 0;
    commentsData = [];
    profilesData = [];
    commentsOrder = null;
    postGroupsData = [];
    myGroupsData = [];
  });

  it('renders the thread oldest-to-newest with author names and a count', async () => {
    commentsData = [
      { id: 'c2', post_id: 'p1', user_id: 'user-me', content: 'Second comment', created_at: '2026-08-02T10:00:00Z' },
      { id: 'c1', post_id: 'p1', user_id: 'u2', content: 'First comment', created_at: '2026-08-01T10:00:00Z' },
    ];
    profilesData = [
      { user_id: 'u2', display_name: 'alice smith', avatar_url: null },
      { user_id: 'user-me', display_name: null, avatar_url: null },
    ];

    renderComments();

    const list = await screen.findByRole('list');
    const items = list.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(commentsOrder).toEqual({ column: 'created_at', ascending: true });
    expect(items[0].textContent).toContain('First comment');
    expect(items[1].textContent).toContain('Second comment');
    expect(screen.getByText(/Comments \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('only shows delete controls for own comments when not a moderator', async () => {
    commentsData = [
      { id: 'c1', post_id: 'p1', user_id: 'u2', content: 'Not mine', created_at: '2026-08-01T10:00:00Z' },
      { id: 'c2', post_id: 'p1', user_id: 'user-me', content: 'Mine', created_at: '2026-08-02T10:00:00Z' },
    ];
    profilesData = [{ user_id: 'u2', display_name: 'Alice', avatar_url: null }];

    renderComments();

    await screen.findByText('Not mine');
    const deleteButtons = screen.getAllByRole('button', { name: /delete comment/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it('shows the empty state when there are no comments', async () => {
    renderComments();

    expect(await screen.findByText(/No comments yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Comments \(0\)/)).toBeInTheDocument();
  });

  it('blocks whitespace-only submissions without inserting', async () => {
    renderComments();

    await screen.findByText(/No comments yet/i);

    const input = screen.getByLabelText(/write a comment/i);
    fireEvent.change(input, { target: { value: '   ' } });

    const submitButton = screen.getByRole('button', { name: /^comment$/i });
    expect(submitButton).toBeDisabled();
    expect(insertedRows).toHaveLength(0);
  });

  it('trims and inserts a valid comment, then clears the draft', async () => {
    renderComments();

    await screen.findByText(/No comments yet/i);

    const input = screen.getByLabelText(/write a comment/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  Hello world  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^comment$/i }));

    await waitFor(() => {
      expect(insertedRows).toHaveLength(1);
    });
    expect(insertedRows[0]).toMatchObject({
      table: 'post_comments',
      payload: { post_id: 'p1', user_id: 'user-me', content: 'Hello world' },
    });
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows delete controls when the current user is group faculty for the post', async () => {
    commentsData = [
      { id: 'c1', post_id: 'p1', user_id: 'u2', content: 'Another user', created_at: '2026-08-01T10:00:00Z' },
      { id: 'c2', post_id: 'p1', user_id: 'user-me', content: 'Mine', created_at: '2026-08-02T10:00:00Z' },
    ];
    profilesData = [
      { user_id: 'u2', display_name: 'alice', avatar_url: null },
      { user_id: 'user-me', display_name: null, avatar_url: null },
    ];
    postGroupsData = [{ group_id: 'group-1' }];
    myGroupsData = [{ id: 'group-1', slug: 'g', name: 'G', is_faculty: true }];

    renderComments();

    const deleteButtons = await screen.findAllByRole('button', { name: /delete comment/i });
    expect(deleteButtons).toHaveLength(2);
  });
});
