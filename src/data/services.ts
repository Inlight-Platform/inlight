// Common freelanceable creative services and the profile keywords
// (skills / badges / tags) that should map a user into each category.

export interface ServiceCategory {
  slug: string;
  label: string;
  emoji: string;
  description: string;
  keywords: string[]; // matched case-insensitively against badges + skills
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: 'photography',
    label: 'Photography',
    emoji: '📷',
    description: 'Headshots, event coverage, editorial, portraits',
    keywords: ['photography', 'photographer', 'photo'],
  },
  {
    slug: 'videography',
    label: 'Videography',
    emoji: '🎥',
    description: 'Filming, b-roll, music videos, event capture',
    keywords: ['videography', 'videographer', 'cinematography', 'camera operation'],
  },
  {
    slug: 'film-production',
    label: 'Film Production',
    emoji: '🎬',
    description: 'Directing, producing, editing, post-production',
    keywords: ['directing', 'producing', 'film production', 'editing', 'video editing', 'post-production'],
  },
  {
    slug: 'songwriting',
    label: 'Songwriting',
    emoji: '🎼',
    description: 'Original songs, topline, lyrics',
    keywords: ['songwriting', 'composition', 'lyrics'],
  },
  {
    slug: 'music-production',
    label: 'Music Production',
    emoji: '🎧',
    description: 'Beats, mixing, mastering, recording',
    keywords: ['music production', 'audio engineering', 'sound mixing', 'sound design', 'producer'],
  },
  {
    slug: 'graphic-design',
    label: 'Graphic Design',
    emoji: '🎨',
    description: 'Posters, branding, social graphics, logos',
    keywords: ['graphic design', 'designer', 'illustration', 'motion graphics', 'art direction'],
  },
  {
    slug: 'painting',
    label: 'Painting & Illustration',
    emoji: '🖌️',
    description: 'Murals, fine art, custom illustration',
    keywords: ['painting', 'painter', 'illustration', 'illustrator', 'fine art'],
  },
  {
    slug: 'writing',
    label: 'Writing',
    emoji: '✍️',
    description: 'Scripts, copy, ghostwriting, dramaturgy',
    keywords: ['screenwriting', 'playwriting', 'creative writing', 'copywriting', 'content writing', 'tv writing', 'dramaturgy'],
  },
  {
    slug: 'acting-coaching',
    label: 'Acting & Coaching',
    emoji: '🎭',
    description: 'Audition coaching, scene work, on-camera training',
    keywords: ['acting', 'auditioning', 'scene study', 'voice acting', 'voiceover'],
  },
  {
    slug: 'costume-design',
    label: 'Costume & Wardrobe',
    emoji: '🧵',
    description: 'Costume design, wardrobe styling, fittings',
    keywords: ['costume design', 'wardrobe styling', 'hair & makeup', 'special effects makeup'],
  },
  {
    slug: 'web-design',
    label: 'Web & Game Design',
    emoji: '💻',
    description: 'Websites, portfolios, interactive design, game design',
    keywords: ['web design', 'game design', 'game designer', 'ui design', 'ux design'],
  },
  {
    slug: 'dance-choreography',
    label: 'Dance & Choreography',
    emoji: '💃',
    description: 'Choreography, movement direction, dance instruction',
    keywords: ['choreography', 'choreographer', 'dance', 'movement'],
  },
];

export const matchesService = (
  category: ServiceCategory,
  tags: (string | null | undefined)[],
): boolean => {
  const haystack = tags
    .filter((t): t is string => !!t)
    .map((t) => t.toLowerCase());
  return category.keywords.some((kw) =>
    haystack.some((t) => t.includes(kw.toLowerCase())),
  );
};
