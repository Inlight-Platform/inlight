import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  claimStoredInvites: vi.fn(),
  hasStoredInviteTokens: vi.fn(),
  storeInviteTokens: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useForceTheme: vi.fn(),
}));

vi.mock('@/components/Starfield', () => ({
  Starfield: () => null,
}));

vi.mock('@/components/Sparkle', () => ({
  Sparkle: () => null,
}));

vi.mock('@/hooks/useAuth', () => ({
  accountAlreadyExistsMessage: 'Your account already exists. Try signing in or resetting your password.',
  useAuth: () => ({
    user: { id: 'invitee_a' },
    loading: false,
    isPasswordRecovery: false,
    recoveryError: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    checkEmailExists: vi.fn(),
  }),
}));

vi.mock('@/lib/inviteClaims', () => ({
  claimStoredInvites: authMocks.claimStoredInvites,
  hasStoredInviteTokens: authMocks.hasStoredInviteTokens,
  storeInviteTokens: authMocks.storeInviteTokens,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

const renderAuthPage = async () => {
  const AuthPage = (await import('@/pages/AuthPage')).default;

  render(
    <MemoryRouter initialEntries={['/auth?mode=signin&credit_invite=token_abc&project_id=project_789']}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/feed" element={<div>Feed</div>} />
        <Route path="/projects/:projectId" element={<div>Project project_789</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AuthPage invite redirect', () => {
  beforeEach(() => {
    authMocks.claimStoredInvites.mockReset();
    authMocks.hasStoredInviteTokens.mockReset();
    authMocks.storeInviteTokens.mockReset();
  });

  it('waits for an authenticated invite claim and opens the claimed project instead of the feed', async () => {
    authMocks.hasStoredInviteTokens.mockReturnValue(true);
    authMocks.claimStoredInvites.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('project_789'), 50))
    );

    await renderAuthPage();

    expect(screen.queryByText('Feed')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Project project_789')).toBeInTheDocument());
    expect(screen.queryByText('Feed')).not.toBeInTheDocument();
    expect(authMocks.storeInviteTokens).toHaveBeenCalledWith(null, 'token_abc', 'project_789');
  });
});
