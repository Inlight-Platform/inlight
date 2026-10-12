import { render, screen } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TrackStop } from '../scrollytelling';

const query = vi.hoisted(() => ({ data: null as unknown, isLoading: false }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => query }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterAll(() => vi.unstubAllGlobals());

describe('TrackStop attribution', () => {
  it('renders each real post with its matching author and identity details', () => {
    query.data = {
      posts: [
        { id: 'post-a', content: 'Alice opened a new show.', created_at: new Date().toISOString(), creator_name: 'Alice Artist', creator_avatar: null, creator_headline: 'Actor', creator_role: null, graduation_year: 2026 },
        { id: 'post-b', content: 'Bob released a single.', created_at: new Date().toISOString(), creator_name: 'Bob Musician', creator_avatar: null, creator_headline: null, creator_role: 'composer', graduation_year: null },
        { id: 'post-c', content: 'Cara filmed a short.', created_at: new Date().toISOString(), creator_name: 'Cara Director', creator_avatar: null, creator_headline: 'Film', creator_role: null, graduation_year: 2027 },
        { id: 'post-d', content: 'Dan designed a set.', created_at: new Date().toISOString(), creator_name: 'Dan Designer', creator_avatar: null, creator_headline: 'Design', creator_role: null, graduation_year: 2025 },
      ],
    };
    render(<TrackStop progress={motionValue(0.5)} />);
    const alice = screen.getByText('Alice Artist').closest('.border-b')?.parentElement;
    const bob = screen.getByText('Bob Musician').closest('.border-b')?.parentElement;
    expect(alice).toHaveTextContent('Alice opened a new show.');
    expect(alice).toHaveTextContent('Actor');
    expect(alice).toHaveTextContent("Class of '26");
    expect(alice).not.toHaveTextContent('Bob released a single.');
    expect(bob).toHaveTextContent('Bob released a single.');
    expect(bob).toHaveTextContent('Composer');
    expect(screen.getAllByText('Latest')).toHaveLength(4);
    expect(screen.getByText('Cara Director')).toBeInTheDocument();
    expect(screen.getByText('Dan Designer')).toBeInTheDocument();
    expect(screen.queryByText('Profile highlight')).not.toBeInTheDocument();
  });

  it('does not manufacture posts or identities when no eligible posts exist', () => {
    query.data = { posts: [] };
    render(<TrackStop progress={motionValue(0.5)} />);
    expect(screen.getByText('New creative work and opportunities appear here as the community shares them.')).toBeInTheDocument();
    expect(screen.queryByText('Alice Artist')).not.toBeInTheDocument();
    expect(screen.queryByText('Latest')).not.toBeInTheDocument();
  });

  it('labels profile biographies separately from actual latest posts', () => {
    query.data = { posts: [
      { id: 'post-a', content: 'A new show.', creator_name: 'Alice Artist', creator_avatar: null, creator_headline: 'Actor', creator_role: null, graduation_year: 2026, is_profile_highlight: false },
      { id: 'profile-b', content: 'A real public biography.', creator_name: 'Bob Musician', creator_avatar: null, creator_headline: 'Composer', creator_role: null, graduation_year: 2027, is_profile_highlight: true },
    ] };
    render(<TrackStop progress={motionValue(0.5)} />);
    const alice = screen.getByText('Alice Artist').closest('.border-b')?.parentElement;
    const bob = screen.getByText('Bob Musician').closest('.border-b')?.parentElement;
    expect(alice).toHaveTextContent('Latest');
    expect(alice).not.toHaveTextContent('Profile highlight');
    expect(bob).toHaveTextContent('Profile highlight');
    expect(bob).toHaveTextContent('A real public biography.');
    expect(bob).not.toHaveTextContent('Latest');
  });
});
