import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import BroadwayShowsManager from './BroadwayShowsManager';
import FilmContentManager from './FilmContentManager';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl }) },
  },
}));

const cases: Array<[string, unknown, string]> = [
  ['Error', new Error('upload failed'), 'upload failed'],
  ['plain object', { message: 'object message' }, 'object message'],
  ['empty message', { message: '' }, 'Unknown error'],
  ['missing message', {}, 'Unknown error'],
  ['string', 'upload failed', 'Unknown error'],
  ['null', null, 'Unknown error'],
  ['undefined', undefined, 'Unknown error'],
  ['non-string message', { message: 42 }, 'Unknown error'],
];

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.upload.mockReset();
  mocks.getPublicUrl.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const managers: Array<[string, React.ReactElement, string, string]> = [
  ['Broadway', <BroadwayShowsManager category="broadway" />, 'Add Show', 'Click to upload cover photo'],
  ['theatre film', <FilmContentManager contentType="theatres" />, 'Add Film', 'Upload Poster'],
  ['streaming film', <FilmContentManager contentType="streaming" />, 'Add Content', 'Upload Poster'],
];

describe.each(managers)('%s upload', (_manager, component, openLabel, readyLabel) => {
  it.each(cases)('reports and cleans up after %s', async (_label, failure, message) => {
    let rejectUpload: (reason?: unknown) => void = () => { throw new Error('Upload was not started'); };
    mocks.upload.mockReturnValue(new Promise((_resolve, reject) => { rejectUpload = reject; }));
    render(component);
    fireEvent.click(screen.getByRole('button', { name: openLabel }));
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing file input');
    const valueSetter = vi.spyOn(input, 'value', 'set');

    fireEvent.change(input, { target: { files: [new File(['image'], 'poster.png', { type: 'image/png' })] } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(screen.getByText('Uploading...')).toBeTruthy();
    await act(async () => { rejectUpload(failure); });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Failed to upload image: ' + message));
    expect(screen.getByText(readyLabel)).toBeTruthy();
    expect(valueSetter).toHaveBeenCalledWith('');
    expect(mocks.getPublicUrl).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
