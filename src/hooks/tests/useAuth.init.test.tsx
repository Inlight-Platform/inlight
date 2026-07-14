import { renderHook } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';

// Mock the supabase client used in useAuth.ts
vi.mock('@/integrations/supabase/client', () => {
  const fakeUser = { id: 'user_1', email: 'test@example.com' };
  return {
    supabase: {
      auth: {
        setSession: vi.fn(async ({ access_token, refresh_token }) => {
          if (access_token === 'bad') {
            return { data: null, error: { message: 'Invalid token' } };
          }
          return { data: { session: { user: fakeUser }, user: fakeUser }, error: null };
        }),
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
        exchangeCodeForSession: vi.fn(async (code: string) => {
          if (code === 'bad') {
            return { data: null, error: { message: 'Bad code' } };
          }
          const fakeUser = { id: 'user_1', email: 'test@example.com' };
          return { data: { session: { user: fakeUser }, user: fakeUser }, error: null };
        }),
      },
      rpc: vi.fn(async () => ({ data: null, error: null })),
      functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    },
  };
});

describe('useAuth initialization (smoke)', () => {
  beforeEach(() => {
    // Reset location/hash between tests
    delete (window as any).location;
    (window as any).location = new URL('http://localhost/');
    (window as any).history.replaceState({}, '', '/');
  });

  it('handles hash tokens and marks recovery when hash type is recovery', async () => {
    (window as any).location = new URL('http://localhost/#access_token=good&refresh_token=ref&token_type=bearer&type=recovery');
    const { result, waitFor } = renderHook(() => require('@/hooks/useAuth').useAuth());

    await waitFor(() => !result.current.loading);
    expect(result.current.session).not.toBeNull();
    expect(result.current.isPasswordRecovery).toBe(true);
  });

  it('handles code exchange and sets recovery when ?type=recovery', async () => {
    (window as any).location = new URL('http://localhost/?code=good&type=recovery');
    const { result, waitFor } = renderHook(() => require('@/hooks/useAuth').useAuth());
    await waitFor(() => !result.current.loading);
    expect(result.current.session).not.toBeNull();
    expect(result.current.isPasswordRecovery).toBe(true);
  });
});
