import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  checkEmailExists: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: authMocks.toastError,
    success: authMocks.toastSuccess,
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
    user: null,
    loading: false,
    isPasswordRecovery: false,
    recoveryError: null,
    signIn: authMocks.signIn,
    signUp: authMocks.signUp,
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    checkEmailExists: authMocks.checkEmailExists,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

const renderAuthPage = async () => {
  const AuthPage = (await import('@/pages/AuthPage')).default;

  render(
    <MemoryRouter initialEntries={['/auth?mode=signup']}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/feed" element={<div>Feed</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AuthPage welcome copy', () => {
  beforeEach(() => {
    authMocks.checkEmailExists.mockReset();
    authMocks.signIn.mockReset();
    authMocks.signUp.mockReset();
    authMocks.toastError.mockReset();
    authMocks.toastSuccess.mockReset();
    window.localStorage.clear();

    authMocks.checkEmailExists.mockResolvedValue({ exists: false, error: null });
    authMocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.signIn.mockResolvedValue({ data: { session: { user: { id: 'issue-69-test' } } }, error: null });
  });

  it('shows a prominent confirmation screen after signup before first sign-in', async () => {
    await renderAuthPage();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Issue 69 Welcome Test' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'issue69-welcome-test-20260718@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Welcome1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }));

    await waitFor(() => {
      expect(screen.getByText('Check your email and confirm your account')).toBeInTheDocument();
    });
    expect(screen.getByText(/issue69-welcome-test-20260718@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Open that email and click the confirmation link before signing in/i)).toBeInTheDocument();
    expect(authMocks.toastSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /i confirmed my email/i }));
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Welcome1!' },
    });
    const signInButtons = screen.getAllByRole('button', { name: /^sign in$/i });
    fireEvent.click(signInButtons[signInButtons.length - 1]);

    await waitFor(() => {
      expect(authMocks.toastSuccess).toHaveBeenCalledWith('Welcome to Inlight!');
    });
    expect(authMocks.toastSuccess).not.toHaveBeenCalledWith('Welcome back!');
  });
});
