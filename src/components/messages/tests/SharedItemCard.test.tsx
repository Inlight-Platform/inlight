import { describe, expect, it } from 'vitest';
import { buildSharedItemMessage, parseSharedItem } from '../SharedItemCard';

const projectId = '12000000-0000-4000-8000-000000000001';

describe('shared item project identity', () => {
  it('round trips a new project share with its explicit ID', () => {
    const item = { type: 'Project', title: 'Project', project_id: projectId, url: '/projects/example' };
    expect(parseSharedItem(buildSharedItemMessage(item))).toEqual(item);
  });

  it.each([undefined, '', 'not-a-uuid'])('refuses to build a new project share with invalid ID %s', (project_id) => {
    expect(() => buildSharedItemMessage({ type: 'Project', title: 'Project', project_id })).toThrow('A valid project ID is required');
  });

  it('keeps valid legacy project cards readable without deriving identity from title', () => {
    expect(parseSharedItem('__SHARED_ITEM__{"type":"Project","title":"Legacy"}__END__'))
      .toEqual({ type: 'Project', title: 'Legacy' });
  });

  it('rejects a card with a malformed explicit project ID', () => {
    expect(parseSharedItem('__SHARED_ITEM__{"type":"Project","title":"Legacy","project_id":"bad"}__END__')).toBeNull();
  });

  it('preserves non-project shares and ordinary messages', () => {
    const item = { type: 'Show', title: 'Show', url: '/show' };
    expect(parseSharedItem(buildSharedItemMessage(item))).toEqual(item);
    expect(parseSharedItem('ordinary message')).toBeNull();
  });
});
