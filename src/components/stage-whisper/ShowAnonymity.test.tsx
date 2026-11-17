import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Show } from './ShowCard';
import { EditShowDialog } from './EditShowDialog';
import { ShowDetailSheet } from './ShowDetailSheet';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  submitterQuery: undefined as undefined | { enabled: boolean; queryFn: () => Promise<unknown> },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: ({ mutationFn, onSuccess }: { mutationFn: () => Promise<void>; onSuccess?: () => void }) => ({
    mutate: () => { void mutationFn().then(() => onSuccess?.()); },
    isPending: false,
  }),
  useQuery: (options: { queryKey: unknown[]; enabled?: boolean; queryFn: () => Promise<unknown> }) => {
    if (options.queryKey[0] === 'show-submitter') {
      mocks.submitterQuery = { enabled: !!options.enabled, queryFn: options.queryFn };
      return { data: options.enabled ? { user_id: 'owner', display_name: 'Submitter', avatar_url: null } : undefined };
    }
    if (options.queryKey[0] === 'show-teammates') {
      if (options.queryKey[1] === 'show-1') return { data: [] };
      return { data: [{ user_id: 'teammate', display_name: 'Teammate', avatar_url: null }] };
    }
    return { data: [] };
  },
}));

const baseShow: Show = {
  id: 'show-1', title: 'A Show', venue: 'Theatre', borough: 'Manhattan',
  description: null, poster_url: null, show_type: 'play', category: 'broadway',
  price_tier: 'budget', run_start: null, run_end: null, accessibility_features: null,
  rush_policy: null, lottery_info: null, official_url: null, is_active: true,
  show_times: null, submitted_by: 'owner', is_owner: true,
};

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterAll(() => { vi.unstubAllGlobals(); });

beforeEach(() => {
  mocks.submitterQuery = undefined;
  mocks.from.mockReset();
  mocks.update.mockReset();
  mocks.eq.mockReset();
  mocks.delete.mockReset();
  mocks.select.mockReset();
  mocks.maybeSingle.mockReset();
  mocks.from.mockReturnValue({ update: mocks.update, delete: mocks.delete, select: mocks.select });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: 'owner', display_name: 'Submitter', avatar_url: null } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('show anonymity', () => {
  it.each([
    ['true', { is_anonymous: true }, true],
    ['false', { is_anonymous: false }, false],
    ['null', { is_anonymous: null }, false],
    ['omitted', {}, false],
  ])('preserves identity display and submitter lookup for %s', async (_label, anonymity, anonymous) => {
    render(
      <MemoryRouter>
        <ShowDetailSheet show={{ ...baseShow, ...anonymity }} isOpen onClose={vi.fn()}
          isSaved={false} onSave={vi.fn()} onUnsave={vi.fn()} />
      </MemoryRouter>,
    );

    expect(mocks.submitterQuery?.enabled).toBe(!anonymous);
    if (anonymous) {
      expect(screen.getByText('Posted anonymously')).toBeTruthy();
      expect(screen.queryByText('Submitter')).toBeNull();
      expect(screen.getByText('Team')).toBeTruthy();
    } else {
      expect(screen.queryByText('Posted anonymously')).toBeNull();
      expect(screen.getByText('Submitter')).toBeTruthy();
      expect(screen.getByText('Posted by')).toBeTruthy();
    }
    const query = mocks.submitterQuery;
    expect(query).toBeDefined();
    if (!query) throw new Error('Missing submitter query');
    await query.queryFn();
    expect(mocks.from).toHaveBeenCalledTimes(anonymous ? 0 : 1);
  });

  it('short-circuits the submitter lookup for a missing show', async () => {
    const { container } = render(
      <MemoryRouter>
        <ShowDetailSheet show={null} isOpen onClose={vi.fn()} isSaved={false}
          onSave={vi.fn()} onUnsave={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
    const query = mocks.submitterQuery;
    expect(query?.enabled).toBe(false);
    if (!query) throw new Error('Missing submitter query');
    expect(await query.queryFn()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    ['true', { is_anonymous: true }, true],
    ['false', { is_anonymous: false }, false],
    ['null', { is_anonymous: null }, false],
    ['omitted', {}, false],
  ])('initializes and submits the existing boolean for %s', async (_label, anonymity, expected) => {
    render(<EditShowDialog show={{ ...baseShow, ...anonymity }} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('switch', { name: /post anonymously/i }).getAttribute('data-state'))
      .toBe(expected ? 'checked' : 'unchecked');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ is_anonymous: expected }));
    expect(mocks.eq).toHaveBeenCalledWith('id', baseShow.id);
  });

  it('resets the switch when the show prop changes and saves the reset value', async () => {
    const { rerender } = render(<EditShowDialog show={{ ...baseShow, is_anonymous: true }} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('switch', { name: /post anonymously/i }).getAttribute('data-state')).toBe('checked');
    rerender(<EditShowDialog show={{ ...baseShow, is_anonymous: null }} />);
    expect(screen.getByRole('switch', { name: /post anonymously/i }).getAttribute('data-state')).toBe('unchecked');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ is_anonymous: false }));
  });
});
