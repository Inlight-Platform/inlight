import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailNotConfirmedMessage } from '@/lib/authVerification';

const authMocks = vi.hoisted(() => ({
  checkEmailExists: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  resend: vi.fn(),
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
    auth: { resend: authMocks.resend },
  },
}));

const renderAuthPage = async (entry = '/auth?mode=signup') => {
  const AuthPage = (await import('@/pages/AuthPage')).default;

  render(
    <MemoryRouter initialEntries={[entry]}>
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
    authMocks.resend.mockReset();
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

  it.each([
    { entry: '/auth?mode=signup&invite=invite-token&returnTo=%2Fgroups%2Finvited', expected: '/groups/invited' },
    { entry: '/auth?mode=signup', expected: null },
  ])('sets or clears the confirmation return marker for $entry', async ({ entry, expected }) => {
    localStorage.setItem('inlight_group_invite_confirm_return_to', '/groups/stale');
    await renderAuthPage(entry);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Person' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Welcome1!' } });
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }));
    await waitFor(() => expect(authMocks.signUp).toHaveBeenCalled());
    expect(localStorage.getItem('inlight_group_invite_confirm_return_to')).toBe(expected);
  });

  it.each([
    { code: 'email_not_confirmed', message: 'Email not confirmed' },
    { message: emailNotConfirmedMessage },
  ])('offers resend for an unconfirmed sign-in error: $message', async (error) => {
    authMocks.signIn.mockResolvedValue({ error });
    await renderAuthPage('/auth?mode=signin');
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'Person@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^sign in$/i }).at(-1)!);
    expect(await screen.findByRole('button', { name: /resend confirmation email/i })).toHaveAttribute('type', 'button');
    expect(screen.getByText(/confirmation needed for person@example.com/i)).toBeInTheDocument();
  });

  it('resends to the submitted email with the plain confirmation URL and shows progress and success', async () => {
    authMocks.signIn.mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    let finishResend!: (value: { error: null }) => void;
    authMocks.resend.mockImplementation(() => new Promise((resolve) => { finishResend = resolve; }));
    await renderAuthPage('/auth?mode=signin');
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'Person@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^sign in$/i }).at(-1)!);
    fireEvent.click(await screen.findByRole('button', { name: /resend confirmation email/i }));
    expect(authMocks.resend).toHaveBeenCalledWith({ type: 'signup', email: 'person@example.com', options: { emailRedirectTo: window.location.origin + '/auth/confirm' } });
    expect(screen.getByRole('button', { name: /sending confirmation email/i })).toBeDisabled();
    finishResend({ error: null });
    expect(await screen.findByText(/confirmation email sent/i)).toBeInTheDocument();
  });

  it('shows feedback when resending fails', async () => {
    authMocks.signIn.mockResolvedValue({ error: { message: emailNotConfirmedMessage } });
    authMocks.resend.mockResolvedValue({ error: { message: 'Unavailable' } });
    await renderAuthPage('/auth?mode=signin');
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'person@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^sign in$/i }).at(-1)!);
    fireEvent.click(await screen.findByRole('button', { name: /resend confirmation email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not resend the confirmation email');
  });
});
