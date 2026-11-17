import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DeleteConfirmDialog } from '../delete-confirm-dialog';
import { server } from '@/test-utils/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.listen({ onUnhandledRequest: 'warn' }));

describe('confirmation labels', () => {
  it('preserves the default event labels', () => {
    const { rerender } = render(<DeleteConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    rerender(<DeleteConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} isPending />);
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
  });

  it('uses project removal labels while idle and pending', () => {
    const { rerender } = render(<DeleteConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} confirmLabel="Remove" pendingLabel="Removing..." />);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
    rerender(<DeleteConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} confirmLabel="Remove" pendingLabel="Removing..." isPending />);
    expect(screen.getByRole('button', { name: 'Removing...' })).toBeDisabled();
  });
});
