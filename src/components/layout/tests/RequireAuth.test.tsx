import React from 'react';
import { describe, it, vi, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

// Mock useAuth to return no user and not loading
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import RequireAuth from '@/components/layout/RequireAuth';

describe('RequireAuth', () => {
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
});
