type FeedDestinationItem = {
  id: string;
  slug?: string | null;
  type: string;
  user_id?: string | null;
  link_url?: string | null;
  project_id?: string | null;
};

const publicIdentifier = (item: FeedDestinationItem) => item.slug?.trim() || item.id;

export type FeedDestination =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; url: string };

const LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

const isInternalHost = (host: string) => {
  if (typeof window === 'undefined') return false;
  const currentHost = window.location.hostname.toLowerCase();
  const candidateHost = host.toLowerCase();

  return (
    candidateHost === currentHost ||
    (LOCALHOSTS.has(candidateHost) && LOCALHOSTS.has(currentHost)) ||
    candidateHost.endsWith('.inlight.social')
  );
};

export const getLinkedPostDestination = (linkUrl?: string | null): FeedDestination | null => {
  const trimmed = linkUrl?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const destinationPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (parsed.origin === window.location.origin || isInternalHost(parsed.hostname)) {
      return { kind: 'internal', to: destinationPath };
    }

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { kind: 'external', url: parsed.toString() };
    }
  } catch {
    return null;
  }

  return null;
};

export const getFeedItemDestination = (item: FeedDestinationItem): FeedDestination | null => {
  if (item.type === 'project') {
    return { kind: 'internal', to: `/projects/${publicIdentifier(item)}` };
  }

  if (item.type === 'show') {
    return { kind: 'internal', to: '/stage-whisper' };
  }

  if (item.type === 'open_role' && item.project_id) {
    return { kind: 'internal', to: `/projects/${item.project_id}` };
  }

  if (item.type === 'job') {
    return { kind: 'internal', to: '/opportunities' };
  }

  if (item.type === 'post') {
    return getLinkedPostDestination(item.link_url);
  }

  return null;
};
