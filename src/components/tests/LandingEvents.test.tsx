import { render } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsStop } from '../scrollytelling';

type EventRow = {
  id: string;
  title: string | null;
  event_date: string | null;
  location: string | null;
  event_type: string | null;
  image_url: string | null;
};

const state = vi.hoisted(() => ({
  queryFn: undefined as undefined | (() => Promise<unknown>),
  upcoming: [] as EventRow[],
  past: [] as EventRow[],
  calls: [] as Array<[string, string, ...unknown[]]>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => {
    state.queryFn = options.queryFn;
    return { data: undefined, isLoading: true };
  },
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let period = '';
      const chain = {
        select: (fields: string) => { state.calls.push([table, 'select', fields]); return chain; },
        not: (field: string, operator: string, value: unknown) => { state.calls.push([table, 'not', field, operator, value]); return chain; },
        eq: (field: string, value: string) => { state.calls.push([table, 'eq', field, value]); return chain; },
        gte: (field: string, value: string) => { period = 'upcoming'; state.calls.push([table, 'gte', field, value]); return chain; },
        lt: (field: string, value: string) => { period = 'past'; state.calls.push([table, 'lt', field, value]); return chain; },
        or: (filter: string) => { state.calls.push([table, 'or', filter]); return chain; },
        order: (field: string, options: unknown) => { state.calls.push([table, 'order', field, options]); return chain; },
        limit: (count: number) => {
          state.calls.push([table, 'limit', count]);
          return Promise.resolve({ data: period === 'upcoming' ? state.upcoming : period === 'past' ? state.past : [], error: null });
        },
      };
      return chain;
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { state.queryFn = undefined; state.upcoming = []; state.past = []; state.calls = []; });

const event = (id: string, title: string | null, event_date: string | null): EventRow => ({
  id, title, event_date, location: null, event_type: null, image_url: null,
});

const loadPreview = async () => {
  render(<EventsStop progress={motionValue(0.5)} />);
  if (!state.queryFn) throw new Error('Landing query was not registered');
  return state.queryFn();
};

describe('landing public event queries', () => {
  it('filters null titles and dates before filling with past events', async () => {
    state.upcoming = [event('u1', 'Upcoming one', '2030-01-01'), event('bad-title', null, '2030-01-02'), event('bad-date', 'Missing date', null), event('u2', 'Upcoming two', '2030-01-03')];
    state.past = [event('bad-past-title', null, '2020-01-06'), event('bad-past-date', 'Missing past date', null), event('p1', 'Recent past', '2020-01-04'), event('p2', 'Older past', '2020-01-03'), event('p3', 'Oldest past', '2020-01-02'), event('p4', 'Outside fill', '2020-01-01')];

    expect(await loadPreview()).toMatchObject({ events: [
      { id: 'p3', title: 'Oldest past' }, { id: 'p2', title: 'Older past' }, { id: 'p1', title: 'Recent past' },
      { id: 'u1', title: 'Upcoming one' }, { id: 'u2', title: 'Upcoming two' },
    ] });
    expect(state.calls.filter(([table, action]) => table === 'events_public_browse' && action === 'select')).toEqual([
      ['events_public_browse', 'select', 'id, title, event_date, location, event_type, image_url'],
      ['events_public_browse', 'select', 'id, title, event_date, location, event_type, image_url'],
    ]);
    expect(state.calls.filter(([table, action]) => table === 'events_public_browse' && action === 'eq')).toEqual([
      ['events_public_browse', 'eq', 'visibility', 'public'], ['events_public_browse', 'eq', 'visibility', 'public'],
    ]);
    expect(state.calls).toContainEqual(['events_public_browse', 'order', 'event_date', { ascending: true }]);
    expect(state.calls).toContainEqual(['events_public_browse', 'order', 'event_date', { ascending: false }]);
    expect(state.calls.filter(([table, action]) => table === 'events_public_browse' && action === 'limit')).toEqual([
      ['events_public_browse', 'limit', 8], ['events_public_browse', 'limit', 8],
    ]);
    expect(state.calls.find(([table, action]) => table === 'events_public_browse' && action === 'gte')).toEqual(['events_public_browse', 'gte', 'event_date', expect.any(String)]);
    expect(state.calls.find(([table, action]) => table === 'events_public_browse' && action === 'lt')).toEqual(['events_public_browse', 'lt', 'event_date', expect.any(String)]);
  });

  it('keeps the first five valid upcoming rows in order without past fill', async () => {
    state.upcoming = [1, 2, 3, 4, 5, 6].map((n) => event(`u${n}`, `Upcoming ${n}`, `2030-01-0${n}`));
    state.past = [event('p1', 'Past event', '2020-01-01')];
    expect(await loadPreview()).toMatchObject({ events: [
      { id: 'u1' }, { id: 'u2' }, { id: 'u3' }, { id: 'u4' }, { id: 'u5' },
    ] });
  });
});
