export const isUuid = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export const publicIdentifier = (item: { slug?: string | null; id: string }) =>
  item.slug?.trim() || item.id;

export const projectPath = (project: { slug?: string | null; id: string }) =>
  `/projects/${publicIdentifier(project)}`;

export const eventPath = (event: { slug?: string | null; id: string }) =>
  `/events/${publicIdentifier(event)}`;
