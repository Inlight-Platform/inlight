import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '@/test-utils/msw/server';
import { PostCreator } from '../PostCreator';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('@/hooks/useAdmin', () => ({ useAdmin: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useGroups', () => ({
  useMyGroups: () => ({ data: [] }),
  useMyScopedAdminGroups: () => ({ data: [] }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: new Proxy({}, {
    get: () => { throw new Error('Unexpected Supabase call in PostCreator test'); },
  }),
}));
vi.mock('embla-carousel-react', () => ({ default: () => [vi.fn(), undefined] }));
vi.mock('../ImageUploader', () => ({ ImageUploader: () => null }));
vi.mock('../AudienceSelector', () => ({ AudienceSelector: () => null }));
vi.mock('../AuthorIdentitySelector', () => ({ AuthorIdentitySelector: () => null }));
vi.mock('@/components/profile/ImagePositioner', () => ({ ImagePositioner: () => null }));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.listen({ onUnhandledRequest: 'warn' }));

function CurrentPath() {
  const { pathname } = useLocation();
  return <div data-testid="current-path">{pathname}</div>;
}

function renderComposer(props: React.ComponentProps<typeof PostCreator>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/feed']}>
        <QueryClientProvider client={queryClient}>
          {children}
          <CurrentPath />
        </QueryClientProvider>
      </MemoryRouter>
    );
  }
  return render(<PostCreator {...props} />, { wrapper: Wrapper });
}

function selectTab(name: string) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false });
}

describe('PostCreator post type', () => {
  it('keeps an event draft selected when onClose changes', async () => {
    const { rerender } = renderComposer({ defaultPostType: 'update', onClose: () => {} });
    selectTab('Event');
    expect(screen.getByRole('tab', { name: 'Event' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByPlaceholderText('Event title...'), { target: { value: 'Event title' } });
    fireEvent.change(screen.getByPlaceholderText('Describe your event...'), { target: { value: 'Event description' } });

    rerender(<PostCreator defaultPostType="update" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByDisplayValue('Event description')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Event' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText('Event title...')).toHaveValue('Event title');
  });

  it('selects Event when defaultPostType changes to event', async () => {
    const { rerender } = renderComposer({ defaultPostType: 'update', onClose: () => {} });
    expect(screen.getByRole('tab', { name: 'Service' })).toHaveAttribute('aria-selected', 'true');
    rerender(<PostCreator defaultPostType="event" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Event' })).toHaveAttribute('aria-selected', 'true'));
  });

  it('navigates to the project creator when the default is project', async () => {
    renderComposer({ defaultPostType: 'project', onClose: () => {} });
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/projects/new'));
  });
});
