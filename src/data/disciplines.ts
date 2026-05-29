export const DISCIPLINES = [
  'Actor',
  'Producer',
  'Filmmaker',
  'Photographer',
  'Designer',
  'Game Designer',
  'Recording Artist',
  'Musician',
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const GOALS = [
  'Building my community',
  'Finding collaborators',
  'Starting a new project',
  'Learning about the industry',
  'Finding resources & tools',
] as const;

export type Goal = (typeof GOALS)[number];

// Complementary disciplines used to bias daily picks
export const COMPLEMENTARY: Record<string, string[]> = {
  Actor: ['Filmmaker', 'Producer', 'Designer'],
  Producer: ['Filmmaker', 'Actor', 'Recording Artist'],
  Filmmaker: ['Producer', 'Actor', 'Photographer'],
  Photographer: ['Filmmaker', 'Designer', 'Producer'],
  Designer: ['Filmmaker', 'Game Designer', 'Photographer'],
  'Game Designer': ['Designer', 'Musician', 'Filmmaker'],
  'Recording Artist': ['Musician', 'Producer', 'Filmmaker'],
  Musician: ['Recording Artist', 'Producer', 'Game Designer'],
};