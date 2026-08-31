import type { Json } from '@/integrations/supabase/types';

export type FeedImagePosition = { x: number; y: number; zoom: number };

export const DEFAULT_FEED_IMAGE_POSITION: FeedImagePosition = { x: 50, y: 50, zoom: 1 };

export const FEED_IMAGE_METADATA_COLUMNS = [
  'image_urls',
  'image_positions',
  'image_zoom',
  'image_position_x',
  'image_position_y',
] as const;

type FeedImageMetadataColumn = (typeof FEED_IMAGE_METADATA_COLUMNS)[number];

type SupabaseColumnError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const serializeFeedImagePositions = (
  positions: FeedImagePosition[],
  count: number,
): Json | null => {
  if (count === 0) return null;

  return Array.from({ length: count }, (_, index) => {
    const position = positions[index] ?? DEFAULT_FEED_IMAGE_POSITION;
    return {
      x: Number.isFinite(position.x) ? position.x : DEFAULT_FEED_IMAGE_POSITION.x,
      y: Number.isFinite(position.y) ? position.y : DEFAULT_FEED_IMAGE_POSITION.y,
      zoom: Number.isFinite(position.zoom) ? position.zoom : DEFAULT_FEED_IMAGE_POSITION.zoom,
    };
  });
};

export const buildFeedImageFields = (
  imageUrls: string[],
  imagePositions: FeedImagePosition[],
) => {
  if (imageUrls.length === 0) return {};

  const primaryPosition = imagePositions[0] ?? DEFAULT_FEED_IMAGE_POSITION;

  return {
    image_url: imageUrls[0],
    image_urls: imageUrls,
    image_position_x: primaryPosition.x,
    image_position_y: primaryPosition.y,
    image_zoom: primaryPosition.zoom,
    image_positions: serializeFeedImagePositions(imagePositions, imageUrls.length),
  };
};

export const getMissingFeedImageColumn = (error: SupabaseColumnError): FeedImageMetadataColumn | null => {
  const errorText = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase();
  if (!errorText) return null;

  return FEED_IMAGE_METADATA_COLUMNS.find((column) => errorText.includes(column)) ?? null;
};

export const omitFeedImageColumn = <TPayload extends Record<string, unknown>>(
  payload: TPayload,
  column: FeedImageMetadataColumn,
) => {
  const next = { ...payload };
  delete next[column];
  return next;
};
