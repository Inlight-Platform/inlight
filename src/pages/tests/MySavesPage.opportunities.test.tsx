import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpportunityView } from '@/hooks/useOpportunities';
import MySavesPage from '../MySavesPage';

const mocks = vi.hoisted(() => ({
  items: [] as Array<{ id: string; item_id: string | null; item_title: string; item_type: string; item_metadata: Record<string, string>; saved_at: string }>,
  live: [] as Array<Record<string, unknown>>,
  singles: {} as Record<string, Record<string, unknown> | null>,
  lookups: [] as Array<[string, string, string]>,
}));

vi.mock('@/lib/featureFlags', () => ({ JOBS_ENABLED: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useSavedItems', () => ({ useSavedItems: () => ({ savedItems: mocks.items, unsaveItem: vi.fn() }) }));
vi.mock('@/hooks/useSavedShows', () => ({ useSavedShows: () => ({ savedShowIds: [], isSaved: () => false, saveShow: vi.fn(), unsaveShow: vi.fn() }) }));
vi.mock('@/hooks/useSavedFilms', () => ({ useSavedFilms: () => ({ savedFilmIds: [], isFilmSaved: () => false, saveFilm: vi.fn(), unsaveFilm: vi.fn() }) }));
vi.mock('@/hooks/useGroupChats', () => ({ useGroupChats: () => ({ groupChats: [] }) }));
vi.mock('@/components/stage-whisper/ShowDetailSheet', () => ({ ShowDetailSheet: () => null }));
vi.mock('@/components/stage-whisper/FilmDetailSheet', () => ({ FilmDetailSheet: () => null }));
vi.mock('@/components/opportunities/ApplicationDialog', () => ({ default: () => null }));
vi.mock('@/components/opportunities/OpportunityDetailSheet', () => ({
  default: ({ opportunity, open, onOpenChange }: { opportunity: OpportunityView | null; open: boolean; onOpenChange: (open: boolean) => void }) => open && opportunity ? (
    <div data-testid="opportunity-detail">
      <pre>{JSON.stringify(opportunity)}</pre>
      <button onClick={() => onOpenChange(false)}>Close details</button>
    </div>
  ) : null,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let field = '';
      let value = '';
      const query = {
        select: () => query,
        eq: (name: string, argument: string) => { field = name; value = argument; return query; },
        in: () => query,
        or: () => query,
        maybeSingle: async () => {
          mocks.lookups.push([table, field, value]);
          return { data: mocks.singles[`${table}:${field}:${value}`] ?? null, error: null };
        },
        then: (resolve: (result: { data: Array<Record<string, unknown>>; error: null }) => unknown) =>
          Promise.resolve({ data: table === 'opportunities' ? mocks.live : [], error: null }).then(resolve),
      };
      return query;
    },
  },
}));

const job = (id: string, title: string, metadata: Record<string, string> = {}) => ({
  id: `saved-${id}`, item_id: id, item_title: title, item_type: 'job', item_metadata: metadata, saved_at: '2026-01-01T00:00:00Z',
});
const row = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, description: 'Live description', type: 'job', status: 'open', posted_by: 'poster',
  created_at: '2026-01-01T00:00:00Z', ...extra,
});
const Location = () => <output data-testid="location">{useLocation().pathname}</output>;
const renderPage = (tab = 'jobs') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: '/saves', search: `?tab=${tab}`, state: { returnTo: '/feed' } }]}><Location /><MySavesPage /></MemoryRouter></QueryClientProvider>);
  return client;
};
const waitForJobs = async (client: QueryClient) => {
  const savedJobs = mocks.items.filter(item => item.item_type === 'job' || item.item_type === 'open_role');
  expect(savedJobs.length).toBeGreaterThan(0);
  const ids = savedJobs.map(item => item.item_id).filter(Boolean);
  const titles = savedJobs.map(item => item.item_title).filter(Boolean);
  await waitFor(() => expect(client.getQueryState(['saved-jobs-live', ids, titles])?.status).toBe('success'));
};
const detail = () => JSON.parse(within(screen.getByTestId('opportunity-detail')).getByText(/"id"/).textContent || '{}');

describe('saved opportunity details', () => {
  beforeEach(() => { mocks.items = []; mocks.live = []; mocks.singles = {}; mocks.lookups = []; });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it.each([
    { label: 'string array', extra: { skills: ['  movement  ', '', 'voice'] }, expected: ['  movement  ', '', 'voice'] },
    { label: 'empty array', extra: { skills: [] }, expected: [] },
    { label: 'absent property', extra: {}, expected: [] },
    { label: 'null', extra: { skills: null }, expected: [] },
    { label: 'string', extra: { skills: 'movement' }, expected: [] },
    { label: 'mixed array', extra: { skills: ['movement', 1] }, expected: [] },
    { label: 'non-string array', extra: { skills: [1, 2] }, expected: [] },
    { label: 'object', extra: { skills: { name: 'movement' } }, expected: [] },
    { label: 'sparse array', extra: { skills: Array(2) }, expected: [] },
  ])('maps cached skills for $label', async ({ extra, expected }) => {
    mocks.items = [job('skills-id', 'Skills job')];
    mocks.live = [row('skills-id', 'Skills job', extra)];
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('Skills job'));
    expect(detail()).toMatchObject({ id: 'skills-id', skills: expected });
    expect(mocks.lookups).toEqual([]);
  });

  it('maps valid skills from a fresh ID lookup', async () => {
    mocks.items = [job('fresh-skills-id', 'Fresh skills job')];
    mocks.singles['opportunities:id:fresh-skills-id'] = row('fresh-skills-id', 'Fresh skills job', { skills: ['  voice  ', ''] });
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('Fresh skills job'));
    await waitFor(() => expect(detail()).toMatchObject({ id: 'fresh-skills-id', skills: ['  voice  ', ''] }));
    expect(mocks.lookups).toEqual([['opportunities', 'id', 'fresh-skills-id']]);
  });

  it('maps a cached live opportunity found by ID', async () => {
    mocks.items = [job('id-one', 'Saved title')];
    mocks.live = [row('id-one', 'Live title', { company: 'Studio', location: 'Chicago', roles: ['Actor'], is_remote: true })];
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('Saved title'));
    expect(detail()).toMatchObject({ id: 'id-one', title: 'Live title', description: 'Live description', company: 'Studio', location: 'Chicago', roles: ['Actor'], isRemote: true });
    expect(mocks.lookups).toEqual([]);
  });

  it('uses a cached title match when the ID is missing', async () => {
    mocks.items = [job('old-id', 'Matching title')];
    mocks.live = [row('new-id', 'Matching title')];
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('Matching title'));
    expect(detail()).toMatchObject({ id: 'new-id', title: 'Matching title', description: 'Live description' });
    expect(mocks.lookups).toEqual([]);
  });

  it('keeps existing fallbacks for null optional live fields', async () => {
    mocks.items = [job('null-fields', 'Null fields')];
    mocks.live = [row('null-fields', 'Null fields', { description: null, company: null, location: null, is_remote: null, experience_level: null, roles: null, requirements: null, tags: null, is_featured: null, action_type: null })];
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('Null fields'));
    expect(detail()).toMatchObject({ description: '', location: 'Remote', isRemote: false, experienceLevel: 'any', roles: [], skills: [], requirements: [], tags: [], isFeatured: false, actionType: 'apply' });
    expect(detail()).not.toHaveProperty('company');
  });

  it('tries fresh ID before title and uses each successful lookup', async () => {
    mocks.items = [job('fresh-id', 'First job'), job('missing-id', 'Second job')];
    mocks.singles['opportunities:id:fresh-id'] = row('fresh-id', 'Fresh by ID');
    mocks.singles['opportunities:title:Second job'] = row('fresh-title-id', 'Fresh by title');
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('First job'));
    await waitFor(() => expect(detail()).toMatchObject({ id: 'fresh-id', title: 'Fresh by ID' }));
    expect(mocks.lookups).toEqual([['opportunities', 'id', 'fresh-id']]);
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    fireEvent.click(screen.getByText('Second job'));
    await waitFor(() => expect(detail()).toMatchObject({ id: 'fresh-title-id', title: 'Fresh by title' }));
    expect(mocks.lookups).toEqual([['opportunities', 'id', 'fresh-id'], ['opportunities', 'id', 'missing-id'], ['opportunities', 'title', 'Second job']]);
  });

  it('uses post details or saved metadata when the opportunity is missing', async () => {
    mocks.items = [job('post-id', 'Post job', { description: 'Saved description' }), job('metadata-id', 'Metadata job', { description: 'Metadata description', location: 'Brooklyn' })];
    mocks.singles['posts:id:post-id'] = { id: 'post-id', content: 'See https://example.test/job', image_url: null, link_url: null, link_title: null, created_at: '2026-02-01T00:00:00Z' };
    const client = renderPage();
    await waitForJobs(client);
    fireEvent.click(await screen.findByText('Post job'));
    await waitFor(() => expect(detail()).toMatchObject({ id: 'post-id', description: 'Saved description', linkUrl: 'https://example.test/job', actionType: 'external', createdAt: '2026-02-01T00:00:00Z' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    fireEvent.click(screen.getByText('Metadata job'));
    await waitFor(() => expect(detail()).toMatchObject({ id: 'metadata-id', description: 'Metadata description', location: 'Brooklyn', actionType: 'apply' }));
    expect(mocks.lookups).toEqual([
      ['opportunities', 'id', 'post-id'], ['opportunities', 'title', 'Post job'], ['posts', 'id', 'post-id'],
      ['opportunities', 'id', 'metadata-id'], ['opportunities', 'title', 'Metadata job'], ['posts', 'id', 'metadata-id'],
    ]);
  });

  it('renders the empty category icon and label and retains back navigation', async () => {
    mocks.items = [job('other-job', 'Other job')];
    const client = renderPage('resources');
    await waitForJobs(client);
    const label = await screen.findByText('No saved resources yet');
    expect(label.parentElement?.querySelector('svg.lucide-book-open')).toBeTruthy();
    const header = screen.getByRole('heading', { name: 'My Saves' }).closest('header');
    expect(header).not.toBeNull();
    if (!header) throw new Error('Missing saves header');
    fireEvent.click(within(header).getByRole('button'));
    expect(screen.getByTestId('location').textContent).toBe('/feed');
  });
});
