import { describe, expect, it } from 'vitest';
import { getFeedItemDestination, getLinkedPostDestination } from './feedDestinations';

describe('feed destination resolution', () => {
  it('routes update posts with relative project links to the project', () => {
    expect(getLinkedPostDestination('/projects/project-123')).toEqual({
      kind: 'internal',
      to: '/projects/project-123',
    });
  });

  it('routes update posts with same-app opportunity links to opportunities', () => {
    expect(getLinkedPostDestination('https://app.inlight.social/opportunities?tab=available')).toEqual({
      kind: 'internal',
      to: '/opportunities?tab=available',
    });
  });

  it('opens external opportunity links directly', () => {
    expect(getLinkedPostDestination('https://example.com/apply')).toEqual({
      kind: 'external',
      url: 'https://example.com/apply',
    });
  });

  it('does not invent a profile destination when update posts are missing links', () => {
    expect(getFeedItemDestination({
      id: 'post-1',
      type: 'post',
      user_id: 'author-1',
      link_url: null,
    })).toBeNull();
  });

  it('keeps existing open role routing pointed at its project', () => {
    expect(getFeedItemDestination({
      id: 'role-1',
      type: 'open_role',
      project_id: 'project-123',
    })).toEqual({
      kind: 'internal',
      to: '/projects/project-123',
    });
  });
});

