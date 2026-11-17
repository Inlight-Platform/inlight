import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/integrations/supabase/types';
import type { OpportunityView } from '@/hooks/useOpportunities';
import MySavesPage from '../MySavesPage';

type StoredRow = {
  id: string; user_id: string; item_type: string; item_id: string | null; item_title: string;
  item_url: string | null; item_metadata: Json | null; saved_at: string;
};
const state = vi.hoisted(() => ({ rows: [] as StoredRow[] }));

vi.mock('@/lib/featureFlags', () => ({ JOBS_ENABLED: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useSavedShows', () => ({ useSavedShows: () => ({ savedShowIds: [], isSaved: () => false, saveShow: vi.fn(), unsaveShow: vi.fn() }) }));
vi.mock('@/hooks/useSavedFilms', () => ({ useSavedFilms: () => ({ savedFilmIds: [], isFilmSaved: () => false, saveFilm: vi.fn(), unsaveFilm: vi.fn() }) }));
vi.mock('@/hooks/useGroupChats', () => ({ useGroupChats: () => ({ groupChats: [] }) }));
vi.mock('@/components/stage-whisper/ShowDetailSheet', () => ({ ShowDetailSheet: () => null }));
vi.mock('@/components/stage-whisper/FilmDetailSheet', () => ({ FilmDetailSheet: () => null }));
vi.mock('@/components/opportunities/ApplicationDialog', () => ({ default: () => null }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src }: { src?: string }) => <img alt="Saved avatar" src={src} />,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({
  default: ({ opportunity, open }: { opportunity: OpportunityView | null; open: boolean }) => open && opportunity ? (
    <pre data-testid="opportunity-detail">{JSON.stringify(opportunity)}</pre>
  ) : null,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const result = () => ({ data: table === 'saved_items' ? state.rows : [], error: null });
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        or: () => query,
        order: async () => result(),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  },
}));

const stored = (type: string, metadata: Json | null): StoredRow => ({
  id: 'saved-1', user_id: 'synthetic-user', item_type: type, item_id: 'item-1', item_title: 'Synthetic item',
  item_url: '/synthetic', item_metadata: metadata, saved_at: '2026-01-01T00:00:00Z',
});
const renderPage = async (tab: string, row: StoredRow) => {
  state.rows = [row];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/saves?tab=${tab}`]}><MySavesPage /></MemoryRouter></QueryClientProvider>);
  await waitFor(() => expect(client.getQueryState(['saved-items', 'synthetic-user'])?.status).toBe('success'));
  if (tab === 'jobs') {
    await waitFor(() => expect(client.getQueryState(['saved-jobs-live', ['item-1'], ['Synthetic item']])?.status).toBe('success'));
  }
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await screen.findByText('Synthetic item');
};
const card = () => {
  const element = screen.getByText('Synthetic item').closest('div.rounded-xl');
  if (!(element instanceof HTMLElement)) throw new Error('Missing saved item card');
  return element;
};
const openDetail = async () => {
  fireEvent.click(screen.getByText('Synthetic item'));
  const element = await screen.findByTestId('opportunity-detail');
  return JSON.parse(element.textContent || '{}');
};

beforeEach(() => { state.rows = []; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('stored saved-item metadata', () => {
  it('renders valid resource description and category', async () => {
    await renderPage('resources', stored('resource', { description: 'Synthetic resource description', category: 'education' }));
    expect(within(card()).getByText('Synthetic resource description')).toBeTruthy();
    expect(within(card()).getByText('education')).toBeTruthy();
  });

  it('supplies a valid person avatar and renders headline and location', async () => {
    await renderPage('people', stored('person', { headline: 'Synthetic headline', location: 'Chicago', avatar_url: 'https://example.test/avatar.png' }));
    expect(within(card()).getByText('Synthetic headline')).toBeTruthy();
    expect(within(card()).getByText('Chicago')).toBeTruthy();
    expect(within(card()).getByRole('img', { name: 'Saved avatar' })).toHaveAttribute('src', 'https://example.test/avatar.png');
  });

  it('maps valid job metadata and existing fallbacks to the detail boundary', async () => {
    await renderPage('jobs', stored('job', { description: 'Synthetic job description', company: 'Synthetic Studio', location: 'Chicago', type: 'job', compensation: null }));
    expect(await openDetail()).toMatchObject({ id: 'item-1', description: 'Synthetic job description', company: 'Synthetic Studio', location: 'Chicago', type: 'job', status: 'open', actionType: 'apply' });
    expect(await screen.findByTestId('opportunity-detail')).not.toHaveTextContent('compensation');
  });

  it('preserves open-role card and detail behavior', async () => {
    await renderPage('jobs', stored('open_role', { projectTitle: 'Synthetic Project', projectId: 'project-1', deadline: '' }));
    expect(within(card()).getByText('Synthetic item')).toBeTruthy();
    expect(await openDetail()).toMatchObject({ id: 'item-1', title: 'Synthetic item', description: '', type: 'job', status: 'open', actionType: 'apply' });
  });

  it('uses missing-field fallbacks for null metadata', async () => {
    await renderPage('jobs', stored('job', null));
    expect(await openDetail()).toMatchObject({ description: '', type: 'job', status: 'open', location: '', actionType: 'apply' });
  });

  it('uses missing-field fallbacks for primitive and array metadata on independent mounts', async () => {
    for (const metadata of ['synthetic primitive', ['synthetic array']]) {
      await renderPage('jobs', stored('job', metadata));
      expect(await openDetail()).toMatchObject({ description: '', type: 'job', status: 'open', location: '', actionType: 'apply' });
      cleanup();
    }
  });

  it('ignores wrongly typed fields while preserving valid card and detail strings', async () => {
    await renderPage('jobs', stored('job', { company: 2718, description: 'Valid description', type: ['bad-type'], location: 'Valid location', compensation: null }));
    const jobCard = card();
    expect(within(jobCard).queryByText('2718')).toBeNull();
    expect(within(jobCard).getByText('Valid description')).toBeTruthy();
    expect(within(jobCard).queryByText('bad-type')).toBeNull();
    expect(within(jobCard).getByText('Valid location')).toBeTruthy();
    const mapped = await openDetail();
    expect(mapped).toMatchObject({ description: 'Valid description', type: 'job', location: 'Valid location' });
    expect(mapped).not.toHaveProperty('company');
    expect(mapped).not.toHaveProperty('compensation');
  });
});
