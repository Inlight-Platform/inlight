import { describe, expect, it } from 'vitest';
import {
  buildFeedImageFields,
  getMissingFeedImageColumn,
  omitFeedImageColumn,
} from './feedImagePayload';

describe('feed image payload helpers', () => {
  it('keeps image_url as the backwards-compatible primary image field', () => {
    expect(buildFeedImageFields(['https://example.com/a.jpg'], [])).toMatchObject({
      image_url: 'https://example.com/a.jpg',
      image_urls: ['https://example.com/a.jpg'],
      image_position_x: 50,
      image_position_y: 50,
      image_zoom: 1,
    });
  });

  it('detects missing Supabase image metadata columns from schema-cache errors', () => {
    expect(getMissingFeedImageColumn({
      code: 'PGRST204',
      message: "Could not find the 'image_urls' column of 'posts' in the schema cache",
    })).toBe('image_urls');

    expect(getMissingFeedImageColumn({
      code: '42703',
      message: 'column posts.image_positions does not exist',
    })).toBe('image_positions');
  });

  it('omits only the unsupported image metadata column', () => {
    expect(omitFeedImageColumn({
      image_url: 'https://example.com/a.jpg',
      image_urls: ['https://example.com/a.jpg'],
      image_zoom: 1,
    }, 'image_urls')).toEqual({
      image_url: 'https://example.com/a.jpg',
      image_zoom: 1,
    });
  });
});
