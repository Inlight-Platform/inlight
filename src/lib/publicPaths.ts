export const isUuid = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export const slugifyTitle = (value?: string | null) => {
  const slug = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return slug || 'untitled';
};

export const identifierFallbackUuid = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  return match?.[0] || null;
};

export const identifierFallbackShortId = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/-([0-9a-f]{8})$/i);
  return match?.[1] || null;
};

export const publicIdentifier = (item: { slug?: string | null; title?: string | null; id: string }) =>
  item.slug?.trim() || slugifyTitle(item.title) || item.id;

export const projectPath = (project: { slug?: string | null; title?: string | null; id: string }) =>
  `/projects/${publicIdentifier(project)}`;

export const eventIdentifier = (event: { slug?: string | null; title?: string | null; id: string }) => {
  const readableSlug = event.slug?.trim() || slugifyTitle(event.title);
  const shortId = event.id.replace(/-/g, '').slice(0, 8);
  return shortId ? `${readableSlug}-${shortId}` : readableSlug;
};

export const eventPath = (event: { slug?: string | null; title?: string | null; id: string }) =>
  `/events/${eventIdentifier(event)}`;
