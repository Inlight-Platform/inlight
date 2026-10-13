import { describe, expect, it } from 'vitest';
import { eventPath, groupEventPath, groupPostIdentifier, groupPostPath, groupProjectPath, identifierFallbackUuid, projectPath } from './publicPaths';

describe('project public paths', () => {
  const firstId = 'e6f08864-03ac-4fc4-9926-9b0281eabb83';
  const secondId = 'e6f08864-03ac-4fc4-9926-9b0281eabb84';

  it('keeps same-title creation results distinct even without returned slugs', () => {
    const first = projectPath({ id: firstId, title: 'Final Showcase' });
    const second = projectPath({ id: secondId, title: 'Final Showcase' });
    expect(first).toBe(`/projects/final-showcase-${firstId}`);
    expect(second).toBe(`/projects/final-showcase-${secondId}`);
    expect(first).not.toBe(second);
    expect(identifierFallbackUuid(second)).toBe(secondId);
  });

  it('keeps the UUID authoritative when a stored slug or title changes', () => {
    const path = projectPath({ id: secondId, slug: 'final-showcase-2', title: 'Renamed project' });
    expect(path).toBe(`/projects/final-showcase-2-${secondId}`);
    expect(identifierFallbackUuid(path)).toBe(secondId);
  });

  it('includes identity even when the title is empty', () => {
    expect(projectPath({ id: secondId, title: '' })).toBe(`/projects/untitled-${secondId}`);
  });

  it('does not change event URL formatting', () => {
    expect(eventPath({ id: firstId, title: 'Final Showcase' })).toBe('/events/final-showcase-e6f08864');
  });
});

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
