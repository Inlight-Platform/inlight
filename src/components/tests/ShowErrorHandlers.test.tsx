import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedShows } from '@/components/profile/SavedShows';
import ShowcaseSettings from '@/components/profile/ShowcaseSettings';
import { AddShowDialog } from '@/components/stage-whisper/AddShowDialog';
import { EditShowDialog } from '@/components/stage-whisper/EditShowDialog';
import type { Show } from '@/components/stage-whisper/ShowCard';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useShowcase', () => ({
  useMyShowcaseProfile: () => ({ profiles: [], isLoading: false, upsert: vi.fn(), isUpdating: false }),
}));
vi.mock('@/lib/imageCompression', () => ({
  isCompressibleImage: () => false,
  compressImage: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload }) },
    from: (table: string) => {
      if (table === 'nyc_shows') {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'show-1' }, error: null }) }) }),
          update: mocks.update,
        };
      }
      return {
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  },
}));

const show: Show = {
  id: 'show-1', title: 'A Show', venue: 'Theatre', borough: 'Manhattan',
  description: null, poster_url: 'old-poster', show_type: 'play', category: 'broadway',
  price_tier: 'budget', run_start: null, run_end: null, accessibility_features: null,
  rush_policy: null, lottery_info: null, official_url: null, is_active: true, show_times: null,
};

const cases: Array<[string, unknown, string]> = [
  ['Error', new Error('failure'), 'failure'],
  ['plain object', { message: 'object failure' }, 'object failure'],
  ['string', 'failure', ''],
  ['null', null, ''],
  ['undefined', undefined, ''],
  ['non-string message', { message: 42 }, ''],
];

const renderWithClient = (element: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
};

const chooseImage = () => {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('Missing image input');
  fireEvent.change(input, { target: { files: [new File(['image'], 'poster.png', { type: 'image/png' })] } });
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
  mocks.upload.mockReset();
  mocks.rpc.mockReset();
  mocks.update.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.rpc.mockImplementation((name: string) =>
    name === 'get_profile_watchlist' ? Promise.resolve({ data: [], error: null }) : Promise.resolve({ error: null }));
  mocks.update.mockReturnValue({ eq: async () => ({ error: null }) });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each(cases)('failure handling: %s', (_label, failure, message) => {
  it('rolls back the watchlist switch and shows its message', async () => {
    mocks.rpc.mockImplementation((name: string) =>
      name === 'get_profile_watchlist' ? Promise.resolve({ data: [], error: null }) : Promise.reject(failure));
    renderWithClient(<SavedShows userId="user-1" isOwnProfile />);
    const toggle = await screen.findByRole('switch', { name: /private/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message || 'Failed to update privacy'));
    expect(screen.getByText('Private — only you can see this')).toBeTruthy();
    expect(toggle.getAttribute('data-state')).toBe('unchecked');
  });

  it('shows the showcase upload message', async () => {
    mocks.upload.mockRejectedValue(failure);
    renderWithClient(<ShowcaseSettings />);
    chooseImage();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message || 'Upload failed'));
  });

  it('logs the add upload failure and does not update the poster', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.upload.mockRejectedValue(failure);
    renderWithClient(<AddShowDialog />);
    fireEvent.click(screen.getByRole('button', { name: /add your show/i }));
    fireEvent.change(screen.getByLabelText(/show title/i), { target: { value: 'A Show' } });
    fireEvent.change(screen.getByLabelText(/venue/i), { target: { value: 'Theatre' } });
    chooseImage();
    fireEvent.click(screen.getByRole('button', { name: /^add show$/i }));
    await waitFor(() => expect(log).toHaveBeenCalledWith('Poster upload failed:', failure));
    expect(mocks.toastError).toHaveBeenCalledWith('Poster upload failed: ' + (message || 'Unknown error'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Failed to upload poster image'));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('logs the edit upload failure and keeps the previous poster', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.upload.mockRejectedValue(failure);
    renderWithClient(<EditShowDialog show={show} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    chooseImage();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(log).toHaveBeenCalledWith('Poster upload failed:', failure));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ poster_url: 'old-poster' })));
  });
});
