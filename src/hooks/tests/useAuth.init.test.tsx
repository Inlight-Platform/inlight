import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';

const fakeUser = { id: 'user_1', email: 'test@example.com' };
let currentSession: { user: typeof fakeUser } | null = null;

// Mock the supabase client used in useAuth.ts
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        setSession: vi.fn(async ({ access_token, refresh_token }) => {
          if (access_token === 'bad') {
            return { data: null, error: { message: 'Invalid token' } };
          }
          currentSession = { user: fakeUser };
          return { data: { session: currentSession, user: fakeUser }, error: null };
        }),
        getSession: vi.fn(async () => ({ data: { session: currentSession } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
        exchangeCodeForSession: vi.fn(async (code: string) => {
          if (code === 'bad') {
            return { data: null, error: { message: 'Bad code' } };
          }
          currentSession = { user: fakeUser };
          return { data: { session: currentSession, user: fakeUser }, error: null };
        }),
      },
      rpc: vi.fn(async () => ({ data: null, error: null })),
      functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    },
  };
});

describe('useAuth initialization (smoke)', () => {
  beforeEach(() => {
    currentSession = null;
    // Reset location/hash between tests
    window.history.replaceState({}, '', '/');
  });

  it('handles hash tokens and marks recovery when hash type is recovery', async () => {
    window.history.replaceState({}, '', '/#access_token=good&refresh_token=ref&token_type=bearer&type=recovery');
    const { useAuth } = await import('@/hooks/useAuth');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).not.toBeNull();
    expect(result.current.isPasswordRecovery).toBe(true);
  });

  it('handles code exchange and sets recovery when ?type=recovery', async () => {
    window.history.replaceState({}, '', '/?code=good&type=recovery');
    const { useAuth } = await import('@/hooks/useAuth');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).not.toBeNull();
    expect(result.current.isPasswordRecovery).toBe(true);
  });
});
