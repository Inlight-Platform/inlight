import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
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

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      verifyOtp: authMocks.verifyOtp,
    },
  },
}));

const renderConfirmPage = async (initialEntry: string) => {
  const AuthConfirmPage = (await import('@/pages/AuthConfirmPage')).default;

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />
        <Route path="/auth" element={<div>Sign in</div>} />
        <Route path="/feed" element={<div>Feed</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AuthConfirmPage', () => {
  beforeEach(() => {
    authMocks.verifyOtp.mockReset();
    authMocks.verifyOtp.mockResolvedValue({ error: null });
  });

  it('verifies token hash confirmation links', async () => {
    await renderConfirmPage('/auth/confirm?token_hash=token_123&type=signup');

    await waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'token_123',
        type: 'signup',
      });
    });
    expect(await screen.findByText('Email verified')).toBeInTheDocument();
  });

  it('does not show a failure when Supabase already consumed the verification token before redirecting back', async () => {
    await renderConfirmPage('/auth/confirm');

    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(await screen.findByText('Email verified')).toBeInTheDocument();
    expect(screen.getByText('Your email is verified. Sign in to continue.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute('href', '/auth');
    expect(screen.queryByText('Verification failed')).not.toBeInTheDocument();
  });

  it('still displays explicit Supabase verification errors', async () => {
    await renderConfirmPage('/auth/confirm#error_description=Token%20has%20expired');

    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('Token has expired')).toBeInTheDocument();
  });
});
