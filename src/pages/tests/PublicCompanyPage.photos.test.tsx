import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCompanyPage from '../PublicCompanyPage';

const state = vi.hoisted(() => ({
  photos: [] as Array<{ id: string; image_url: string; caption: string | null }>,
  rpc: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: state.rpc,
    from: () => {
      const chain = {
        select: () => chain, eq: () => chain,
        maybeSingle: async () => ({ data: { id: 'company-1', name: 'Company', fun_facts: null }, error: null }),
      };
      return chain;
    },
  },
}));
const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter initialEntries={['/company/company-1']}><QueryClientProvider client={client}>
    <Routes><Route path="/company/:companyId" element={<PublicCompanyPage />} /></Routes>
  </QueryClientProvider></MemoryRouter>);
};
beforeEach(() => {
  state.photos = [];
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_company_photos_browse' ? state.photos : [], error: null }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('public company photos', () => {
  it('renders returned photo URLs in order without displaying captions', async () => {
    state.photos = [
      { id: 'p2', image_url: 'https://example.test/second.jpg', caption: null },
      { id: 'p1', image_url: 'https://example.test/first.jpg', caption: 'Caption' },
    ];
    renderPage();
    await screen.findByRole('heading', { name: 'Photos' });
    expect(state.rpc).toHaveBeenCalledWith('get_company_photos_browse', { _company_id: 'company-1' });
    const images = screen.getAllByRole('img', { name: '' });
    expect(images.map((image) => image.getAttribute('src'))).toEqual(state.photos.map((photo) => photo.image_url));
    expect(images.map((image) => image.closest('a')?.getAttribute('href'))).toEqual(state.photos.map((photo) => photo.image_url));
    expect(screen.queryByText('Caption')).toBeNull();
  });

  it('does not render the photo section for an empty response', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Company' });
    expect(screen.queryByRole('heading', { name: 'Photos' })).toBeNull();
  });
});
