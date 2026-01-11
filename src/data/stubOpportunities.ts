import { Opportunity } from '../store/opportunitiesStore';

const getDaysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const getDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const stubOpportunities: Opportunity[] = [
  {
    id: 'opp-1',
    title: 'Lead Actor for Indie Thriller',
    companyName: 'Midnight Productions',
    typeTag: 'Feature',
    paidStatus: 'Paid',
    unionStatus: 'Union',
    postedDate: getDaysAgo(2),
    deadline: getDaysFromNow(14),
    bookmarked: false,
    applicantCount: 23,
    logoURL: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop',
    posterUserId: 'user-4',
    roleTags: ['Actor'],
    isRemote: false,
    location: 'Los Angeles, CA',
    description: `We're seeking a talented lead actor for an upcoming psychological thriller. The role requires someone who can portray complex emotional depth and navigate morally ambiguous territory.

**The Story**: A detective becomes obsessed with solving a cold case that hits too close to home, blurring the lines between justice and vengeance.

This is a SAG-AFTRA production with full union rates and benefits. Principal photography begins in March 2024.`,
    requirements: [
      'SAG-AFTRA membership required',
      '5+ years acting experience',
      'Available for 6-week shoot in LA',
      'Comfortable with intense dramatic scenes',
      'Must submit self-tape with application'
    ],
    compensation: 'SAG-AFTRA Scale + 10% bump for lead',
    compensationMin: 3500,
    compensationMax: 5000,
    compensationPer: 'Day',
    coverImage: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-2',
    title: 'Film Composer - Horror Short',
    companyName: 'Dread Films',
    typeTag: 'Short Film',
    paidStatus: 'Paid',
    unionStatus: 'Open',
    postedDate: getDaysAgo(1),
    deadline: getDaysFromNow(21),
    bookmarked: false,
    applicantCount: 8,
    logoURL: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop',
    posterUserId: 'user-15',
    roleTags: ['Musician'],
    isRemote: true,
    description: `Looking for a composer to create an atmospheric, tension-building score for our 15-minute horror short.

**Tone**: Think John Carpenter meets Ari Aster. We want something that creeps under your skin.

This is a fully remote position. You'll work directly with our director to craft the perfect sonic landscape for our film.`,
    requirements: [
      'Portfolio with horror/thriller work',
      'Proficiency in DAW (Logic, Ableton, Pro Tools)',
      'Ability to meet tight deadlines',
      'Experience with sound design a plus'
    ],
    compensation: 'Flat fee for completed score',
    compensationMin: 2500,
    compensationMax: 4000,
    compensationPer: 'Flat',
    coverImage: 'https://images.unsplash.com/photo-1509248961895-40fc11e3e219?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-3',
    title: 'Associate Producer - Documentary Series',
    companyName: 'Truth & Light Media',
    typeTag: 'Feature',
    paidStatus: 'Paid',
    unionStatus: 'Non-Union',
    postedDate: getDaysAgo(5),
    deadline: getDaysFromNow(10),
    bookmarked: false,
    applicantCount: 45,
    logoURL: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100&h=100&fit=crop',
    posterUserId: 'user-8',
    roleTags: ['Producer'],
    isRemote: false,
    location: 'Chicago, IL',
    description: `Join our Emmy-winning team for a 6-part documentary series exploring climate activism across America.

**Your Role**: Support day-to-day production, coordinate with subjects, manage schedules, and assist in story development.

This is an incredible opportunity to work with experienced documentary filmmakers on a project with real impact.`,
    requirements: [
      '2+ years production experience',
      'Strong organizational skills',
      'Experience with documentary preferred',
      'Passionate about social impact storytelling',
      'Valid driver\'s license for travel'
    ],
    compensation: 'Competitive weekly rate',
    compensationMin: 1500,
    compensationMax: 2000,
    compensationPer: 'Week',
    coverImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-4',
    title: 'Session Guitarist - Album Recording',
    companyName: 'Vinyl Dreams Records',
    typeTag: 'Remote Session',
    paidStatus: 'Paid',
    unionStatus: 'Open',
    postedDate: getDaysAgo(3),
    deadline: getDaysFromNow(7),
    bookmarked: false,
    applicantCount: 12,
    logoURL: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop',
    posterUserId: 'user-7',
    roleTags: ['Musician'],
    isRemote: true,
    description: `We need a versatile session guitarist for an indie rock album. Looking for someone who can bring energy and creativity to 10 tracks.

**Style**: Think War on Drugs meets Wilco. Atmospheric, layered guitar work with emotional depth.

Remote recording accepted with professional setup. Must be able to take direction and deliver polished takes.`,
    requirements: [
      'Professional home studio setup',
      'Experience with indie/alternative rock',
      'Ability to read charts and take direction',
      'Quick turnaround on revisions',
      'References from previous sessions'
    ],
    compensation: 'Per-track rate negotiable',
    compensationMin: 200,
    compensationMax: 400,
    compensationPer: 'Flat',
    coverImage: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-5',
    title: 'Director - Music Video',
    companyName: 'Neon Pulse Entertainment',
    typeTag: 'Gig',
    paidStatus: 'Paid',
    unionStatus: 'Non-Union',
    postedDate: getDaysAgo(1),
    deadline: getDaysFromNow(5),
    bookmarked: false,
    applicantCount: 31,
    logoURL: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=100&h=100&fit=crop',
    posterUserId: 'user-11',
    roleTags: ['Director'],
    isRemote: false,
    location: 'Austin, TX',
    description: `Rising artist seeking a visionary director for debut single music video. Budget: $15K all-in.

**Concept**: Surreal, dreamy visuals. Think Michel Gondry meets Hype Williams. We want something that goes viral.

Looking for someone with a strong visual style who can work within budget while delivering something special.`,
    requirements: [
      'Reel showcasing music video work',
      'Experience working with limited budgets',
      'Available for 2-day shoot in Austin',
      'Collaborative spirit with artist input',
      'Understanding of current visual trends'
    ],
    compensation: 'Director fee from overall budget',
    compensationMin: 3000,
    compensationMax: 5000,
    compensationPer: 'Flat',
    coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-6',
    title: 'Background Actors - Period Drama',
    companyName: 'Heritage Films',
    typeTag: 'Feature',
    paidStatus: 'Paid',
    unionStatus: 'Open',
    postedDate: getDaysAgo(4),
    deadline: getDaysFromNow(3),
    bookmarked: false,
    applicantCount: 156,
    posterUserId: 'user-1',
    roleTags: ['Actor'],
    isRemote: false,
    location: 'Atlanta, GA',
    description: `Seeking 50+ background actors for a 1920s period drama. Multiple dates available throughout February and March.

**Setting**: Gatsby-era elegance. Ballrooms, speakeasies, and jazz clubs.

All costumes and styling provided. Great opportunity to be part of a major production.`,
    requirements: [
      'Available for multiple shoot dates',
      'Comfortable with period costumes and styling',
      'Reliable transportation to Atlanta locations',
      'Professional attitude on set',
      'No visible modern tattoos or piercings'
    ],
    compensation: 'Standard background rates + meals',
    compensationMin: 150,
    compensationMax: 200,
    compensationPer: 'Day',
    coverImage: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-7',
    title: 'Showrunner\'s Assistant - Streaming Series',
    companyName: 'Streamline Studios',
    typeTag: 'Gig',
    paidStatus: 'Paid',
    unionStatus: 'Non-Union',
    postedDate: getDaysAgo(6),
    deadline: getDaysFromNow(8),
    bookmarked: false,
    applicantCount: 89,
    logoURL: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=100&h=100&fit=crop',
    posterUserId: 'user-4',
    roleTags: ['Producer'],
    isRemote: false,
    location: 'Los Angeles, CA',
    description: `Incredible opportunity to work alongside an Emmy-winning showrunner on a major streaming drama.

**The Role**: Manage the showrunner's schedule, coordinate with writing room, handle script distribution, and provide general support.

This is a fast-paced environment perfect for someone looking to learn the TV business from the inside.`,
    requirements: [
      'Previous entertainment industry experience',
      'Exceptional organizational skills',
      'Discretion with confidential information',
      'Available to start immediately',
      'Comfortable with long hours during production'
    ],
    compensation: 'Competitive salary + benefits',
    compensationMin: 800,
    compensationMax: 1200,
    compensationPer: 'Week',
    coverImage: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-8',
    title: 'Touring Keyboardist - National Tour',
    companyName: 'Soundwave Management',
    typeTag: 'Touring',
    paidStatus: 'Paid',
    unionStatus: 'Open',
    postedDate: getDaysAgo(2),
    deadline: getDaysFromNow(12),
    bookmarked: false,
    applicantCount: 19,
    logoURL: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=100&h=100&fit=crop',
    posterUserId: 'user-3',
    roleTags: ['Musician'],
    isRemote: false,
    location: 'Nashville, TN',
    description: `Join a Grammy-nominated artist on their 30-date national tour starting this spring.

**What We Need**: A versatile keyboardist who can handle synths, piano, and organ. Must be comfortable with in-ears and click tracks.

Full tour support including travel, hotels, and per diem.`,
    requirements: [
      'Extensive touring experience',
      'Proficiency with multiple keyboard setups',
      'Ability to learn material quickly',
      'Valid passport for potential international dates',
      'Team player attitude'
    ],
    compensation: 'Weekly salary + tour support',
    compensationMin: 2000,
    compensationMax: 3000,
    compensationPer: 'Week',
    coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-9',
    title: 'Voice Actor - Animation Pilot',
    companyName: 'Toon Factory',
    typeTag: 'Gig',
    paidStatus: 'Unpaid',
    unionStatus: 'Non-Union',
    postedDate: getDaysAgo(7),
    deadline: getDaysFromNow(14),
    bookmarked: false,
    applicantCount: 67,
    posterUserId: 'user-2',
    roleTags: ['Actor'],
    isRemote: true,
    description: `We're producing an animated pilot and need talented voice actors for several characters.

**The Project**: A comedic adventure series aimed at young adults. Think Adventure Time meets Rick and Morty.

This is currently unpaid but with SAG-AFTRA rates guaranteed if picked up to series.`,
    requirements: [
      'Voice acting demo reel required',
      'Ability to create distinct character voices',
      'Home recording setup (professional quality)',
      'Available for multiple recording sessions',
      'Improv skills a plus'
    ],
    coverImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-10',
    title: 'Line Producer - Indie Feature',
    companyName: 'Grassroots Cinema',
    typeTag: 'Feature',
    paidStatus: 'Paid',
    unionStatus: 'Non-Union',
    postedDate: getDaysAgo(3),
    deadline: getDaysFromNow(18),
    bookmarked: false,
    applicantCount: 14,
    logoURL: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100&h=100&fit=crop',
    posterUserId: 'user-13',
    roleTags: ['Producer'],
    isRemote: false,
    location: 'San Francisco, CA',
    description: `Seeking an experienced line producer for a character-driven indie feature. Budget: $500K.

**The Film**: A meditation on grief and memory set in San Francisco. 25-day shoot planned for summer 2024.

Looking for someone who can stretch every dollar while maintaining quality and keeping the crew happy.`,
    requirements: [
      'Previous line producing credits',
      'Experience with budgets under $1M',
      'Strong relationships with Bay Area crews',
      'Movie Magic Budgeting proficiency',
      'Calm under pressure'
    ],
    compensation: 'Negotiable based on experience',
    compensationMin: 1000,
    compensationMax: 1500,
    compensationPer: 'Week',
    coverImage: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-11',
    title: 'Music Supervisor - Podcast Network',
    companyName: 'Audio First Media',
    typeTag: 'Remote Session',
    paidStatus: 'Paid',
    unionStatus: 'Non-Union',
    postedDate: getDaysAgo(4),
    deadline: getDaysFromNow(21),
    bookmarked: false,
    applicantCount: 7,
    posterUserId: 'user-10',
    roleTags: ['Musician', 'Producer'],
    isRemote: true,
    description: `Growing podcast network needs a part-time music supervisor to handle licensing and original music for 12+ shows.

**The Role**: Source and license music, work with composers, manage music budgets, and ensure all clearances are in order.

This is an ongoing freelance position with potential to grow.`,
    requirements: [
      'Music licensing experience',
      'Relationships with publishers and composers',
      'Understanding of podcast/audio rights',
      'Organized and detail-oriented',
      'Ability to work under tight deadlines'
    ],
    compensation: 'Monthly retainer',
    compensationMin: 2000,
    compensationMax: 3500,
    compensationPer: 'Flat',
    coverImage: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=450&fit=crop',
  },
  {
    id: 'opp-12',
    title: 'Stunt Double - Action Feature',
    companyName: 'Velocity Pictures',
    typeTag: 'Feature',
    paidStatus: 'Paid',
    unionStatus: 'Union',
    postedDate: getDaysAgo(1),
    deadline: getDaysFromNow(6),
    bookmarked: false,
    applicantCount: 28,
    logoURL: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=100&h=100&fit=crop',
    posterUserId: 'user-9',
    roleTags: ['Actor'],
    isRemote: false,
    location: 'Atlanta, GA',
    description: `Looking for experienced stunt performers to double for lead actors in high-octane action sequences.

**The Production**: A major studio action film with extensive car chases, fights, and wirework.

SAG-AFTRA stunt rates plus adjustments for hazardous work. Stunt coordinator on set at all times.`,
    requirements: [
      'SAG-AFTRA stunt registration',
      'Extensive stunt reel with verifiable credits',
      'Proficiency in martial arts and wirework',
      'Valid driver\'s license with stunt driving experience',
      'Current physical fitness certification'
    ],
    compensation: 'SAG-AFTRA stunt rates + adjustments',
    compensationMin: 1000,
    compensationMax: 2500,
    compensationPer: 'Day',
    coverImage: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=800&h=450&fit=crop',
  },
];
