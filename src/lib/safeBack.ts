// Returns a navigation handler that goes back in browser history,
// but only if the previous entry is a known sidebar route. Otherwise
// it routes to the provided fallback (a sidebar page).
//
// Sidebar routes (kept in sync with MainNav):
export const SIDEBAR_ROUTES = [
  '/feed',
  '/people',
  '/mutuals',
  '/insights',
  '/events',
  '/opportunities',
  '/messages',
  '/notifications',
  '/network',
  '/resources',
  '/stage-whisper',
  '/saves',
  '/settings',
  '/admin',
] as const;

export const isSidebarRoute = (path: string): boolean => {
  if (!path) return false;
  // Exact match against known sidebar entries (allow trailing query/hash)
  const clean = path.split('?')[0].split('#')[0];
  return SIDEBAR_ROUTES.some((r) => clean === r);
};

import type { Location, NavigateFunction } from 'react-router-dom';

/**
 * Navigate back to the previous page IF it's a sidebar destination,
 * otherwise navigate to the provided fallback sidebar route.
 *
 * Uses sessionStorage breadcrumb tracking via `recordRoute` (call from
 * a top-level effect in PageLayout) to know the previous sidebar route.
 */
export const safeBack = (
  navigate: NavigateFunction,
  fallback: string = '/feed',
  current?: string
) => {
  try {
    const raw = sessionStorage.getItem('inlight_last_sidebar_route');
    if (raw && isSidebarRoute(raw) && raw !== current) {
      navigate(raw);
      return;
    }

    const previous = sessionStorage.getItem('inlight_previous_sidebar_route');
    if (previous && isSidebarRoute(previous) && previous !== current) {
      navigate(previous);
      return;
    }
  } catch {
    // ignore storage errors
  }
  navigate(fallback);
};

export const currentRoute = (location: Pick<Location, 'pathname' | 'search' | 'hash'>): string =>
  `${location.pathname}${location.search}${location.hash}`;

/**
 * Records the current path as the most-recent sidebar route, if it is one.
 * Call from PageLayout on every location change.
 */
export const recordRoute = (path: string) => {
  try {
    if (isSidebarRoute(path)) {
      const current = sessionStorage.getItem('inlight_last_sidebar_route');
      if (current && current !== path) {
        sessionStorage.setItem('inlight_previous_sidebar_route', current);
      }
      sessionStorage.setItem('inlight_last_sidebar_route', path);
    }
  } catch {
    // ignore
  }
};
