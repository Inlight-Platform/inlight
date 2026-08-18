import React from 'react';
import { beforeEach, describe, it, vi, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

const authMock = vi.hoisted(() => ({
  user: null as null | { id: string; email_confirmed_at?: string | null; confirmed_at?: string | null },
}));

// Mock useAuth to return controlled auth state
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: authMock.user, loading: false }),
}));

import RequireAuth from '@/components/layout/RequireAuth';

describe('RequireAuth', () => {
  beforeEach(() => {
    authMock.user = null;
  });

  it('redirects anonymous users to /auth', async () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
          <Route path="/auth" element={<div data-testid="auth">AuthPage</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('auth')).toBeInTheDocument();
  });

  it('redirects unconfirmed users to /auth', async () => {
    authMock.user = { id: 'user_1', email_confirmed_at: null, confirmed_at: null };

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
          <Route path="/auth" element={<div data-testid="auth">AuthPage</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('auth')).toBeInTheDocument();
  });

  it('allows confirmed users through', async () => {
    authMock.user = { id: 'user_1', email_confirmed_at: '2026-08-16T00:00:00.000Z' };

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div data-testid="protected">Protected</div>} />
          </Route>
          <Route path="/auth" element={<div data-testid="auth">AuthPage</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('protected')).toBeInTheDocument();
  });
});
