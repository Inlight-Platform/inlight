import { describe, expect, it } from 'vitest';
import { groupEventPath, groupPostIdentifier, groupPostPath, groupProjectPath } from './publicPaths';

describe('group post public paths', () => {
  const post = {
    id: 'e6f08864-03ac-4fc4-9926-9b0281eabb83',
    content: 'Run club updates\n\nMeet us on Friday.',
  };

  it('builds a readable identifier with a unique short id', () => {
    expect(groupPostIdentifier(post)).toBe('run-club-updates-e6f08864');
  });

  it('keeps the post inside its department route', () => {
    expect(groupPostPath('stella-adler-studio', post)).toBe(
      '/groups/stella-adler-studio/posts/run-club-updates-e6f08864',
    );
  });

  it('builds unique department routes for events and projects', () => {
    expect(groupEventPath('stella-adler-studio', { id: post.id, title: 'Run club' })).toBe(
      '/groups/stella-adler-studio/events/run-club-e6f08864',
    );
    expect(groupProjectPath('stella-adler-studio', { id: post.id, title: 'Final showcase' })).toBe(
      '/groups/stella-adler-studio/projects/final-showcase-e6f08864',
    );
  });
});
