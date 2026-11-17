import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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
  const AuthDestination = () => <div>Auth destination: {useLocation().search}</div>;

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />
        <Route path="/auth" element={<AuthDestination />} />
        <Route path="/feed" element={<div>Feed</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AuthConfirmPage', () => {
  beforeEach(() => {
    localStorage.clear();
    authMocks.verifyOtp.mockReset();
    authMocks.verifyOtp.mockResolvedValue({ error: null });
  });

  it('opens the invited group through auth and consumes the marker after success', async () => {
    localStorage.setItem('inlight_group_invite_confirm_return_to', '/groups/invited');
    await renderConfirmPage('/auth/confirm?token_hash=token_123&type=signup');
    await screen.findByText('Email verified');
    expect(localStorage.getItem('inlight_group_invite_confirm_return_to')).toBeNull();
    expect(await screen.findByText('Auth destination: ?returnTo=%2Fgroups%2Finvited', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('keeps the invited destination when the token is cleared during verification', async () => {
    localStorage.setItem('inlight_group_invite_confirm_return_to', '/groups/invited');
    localStorage.setItem('inlight_platform_invite_token', 'invite-token');
    authMocks.verifyOtp.mockImplementation(async () => {
      localStorage.removeItem('inlight_platform_invite_token');
      return { error: null };
    });
    await renderConfirmPage('/auth/confirm?token_hash=token_123&type=signup');
    expect(await screen.findByText('Auth destination: ?returnTo=%2Fgroups%2Finvited', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it.each([null, '//evil.example/path', '/\\evil.example', '/feed', 'https://evil.example/groups/a'])('falls back to feed for missing or unsafe marker %s', async (value) => {
    if (value) localStorage.setItem('inlight_group_invite_confirm_return_to', value);
    await renderConfirmPage('/auth/confirm?token_hash=token_123&type=signup');
    expect(await screen.findByText('Feed', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(localStorage.getItem('inlight_group_invite_confirm_return_to')).toBeNull();
  });

  it('retains the marker when verification fails', async () => {
    localStorage.setItem('inlight_group_invite_confirm_return_to', '/groups/invited');
    authMocks.verifyOtp.mockResolvedValue({ error: { message: 'Invalid token' } });
    await renderConfirmPage('/auth/confirm?token_hash=token_123&type=signup');
    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(localStorage.getItem('inlight_group_invite_confirm_return_to')).toBe('/groups/invited');
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
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute('href', '/auth?mode=signin');
    expect(screen.queryByText('Verification failed')).not.toBeInTheDocument();
  });

  it('still displays explicit Supabase verification errors', async () => {
    await renderConfirmPage('/auth/confirm#error_description=Token%20has%20expired');

    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('Token has expired')).toBeInTheDocument();
  });
});
