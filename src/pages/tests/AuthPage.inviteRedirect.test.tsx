import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  claimStoredInvites: vi.fn(),
  hasStoredInviteTokens: vi.fn(),
  storeInviteTokens: vi.fn(),
  signIn: vi.fn(),
  rpc: vi.fn(),
  user: { id: 'invitee_a' } as { id: string } | null,
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
    user: authMocks.user,
    loading: false,
    isPasswordRecovery: false,
    recoveryError: null,
    signIn: authMocks.signIn,
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
    rpc: authMocks.rpc,
  },
}));

const renderAuthPage = async (entry = '/auth?mode=signin&credit_invite=token_abc&project_id=project_789') => {
  const AuthPage = (await import('@/pages/AuthPage')).default;

  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/feed" element={<div>Feed</div>} />
        <Route path="/projects/:projectId" element={<div>Project project_789</div>} />
        <Route path="/groups/:slug" element={<div>Requested group</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AuthPage invite redirect', () => {
  beforeEach(() => {
    authMocks.claimStoredInvites.mockReset();
    authMocks.hasStoredInviteTokens.mockReset();
    authMocks.storeInviteTokens.mockReset();
    authMocks.signIn.mockReset();
    authMocks.rpc.mockReset();
    authMocks.user = { id: 'invitee_a' };
    window.localStorage.clear();
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

  it('opens the explicit invite return path after login instead of the first faculty group', async () => {
    authMocks.user = null;
    authMocks.signIn.mockResolvedValue({ error: null });
    authMocks.claimStoredInvites.mockResolvedValue(null);
    authMocks.rpc.mockResolvedValue({ data: [{ slug: 'other-group' }], error: null });

    await renderAuthPage('/auth?invite=token_abc&returnTo=%2Fgroups%2Finvited');
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'invitee@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^sign in$/i }).at(-1)!);

    await waitFor(() => expect(screen.getByText('Requested group')).toBeInTheDocument());
    expect(authMocks.claimStoredInvites).toHaveBeenCalled();
    expect(authMocks.rpc).not.toHaveBeenCalledWith('get_my_faculty_group');
  });
});
