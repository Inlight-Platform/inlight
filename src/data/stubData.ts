import { User, Material, Credit, Connection, Story, Message, Thread, Event, Opportunity } from '../store/useStore';

// 20+ users with varied badges, credits, materials
export const stubUsers: User[] = [
  {
    id: 'user-1',
    name: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=450&fit=crop',
    role: 'Director',
    location: 'Los Angeles, CA',
    pronouns: 'he/him',
    bio: 'Award-winning director with 10+ years experience in indie film. Passionate about authentic storytelling and diverse voices.',
    badges: ['nycdirector', 'horrorproducer', 'sundance2024', 'wga'],
    unionStatus: 'DGA Member',
    representation: 'CAA - Michael Chen',
    availability: ['2024-02', '2024-03', '2024-04'],
    gearList: ['RED Komodo', 'Blackmagic Pocket 6K', 'DJI RS3'],
    lastPostDates: ['2024-01-20', '2024-01-21', '2024-01-22', '2024-01-23', '2024-01-24']
  },
  {
    id: 'user-2',
    name: 'Jordan Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=450&fit=crop',
    role: 'Actor',
    location: 'New York, NY',
    pronouns: 'she/her',
    bio: 'Stage and screen actor specializing in dramatic roles. Broadway credits include Hamilton and Dear Evan Hansen.',
    badges: ['sag-aftra', 'broadway', 'actorsequity', 'voiceover'],
    unionStatus: 'SAG-AFTRA',
    representation: 'WME - Sarah Lopez',
    availability: ['2024-03', '2024-05'],
    gearList: [],
    lastPostDates: ['2024-01-22', '2024-01-23']
  },
  {
    id: 'user-3',
    name: 'Marcus Thompson',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&h=450&fit=crop',
    role: 'Musician',
    location: 'Nashville, TN',
    pronouns: 'he/him',
    bio: 'Grammy-nominated composer and producer. Specializing in film scores and electronic music.',
    badges: ['abletonlive', 'filmcomposer', 'ascap', 'synthwave'],
    unionStatus: 'AFM Member',
    representation: 'Independent',
    availability: ['2024-02', '2024-04', '2024-06'],
    gearList: ['Ableton Live 11', 'Native Instruments Komplete', 'UAD Apollo'],
    lastPostDates: ['2024-01-24']
  },
  {
    id: 'user-4',
    name: 'Sofia Martinez',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=450&fit=crop',
    role: 'Producer',
    location: 'Miami, FL',
    pronouns: 'she/her',
    bio: 'Executive producer with Netflix and HBO credits. Focused on Latinx stories and international co-productions.',
    badges: ['horrorproducer', 'pga', 'netflix', 'latinxfilm'],
    unionStatus: 'PGA Member',
    representation: 'UTA - James Wilson',
    availability: ['2024-01', '2024-02'],
    gearList: [],
    lastPostDates: ['2024-01-20', '2024-01-21', '2024-01-22', '2024-01-23', '2024-01-24']
  },
  {
    id: 'user-5',
    name: 'David Kim',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=450&fit=crop',
    role: 'Director',
    location: 'Seoul / LA',
    pronouns: 'he/him',
    bio: 'International director bridging Korean and Hollywood cinema. A24 alumni.',
    badges: ['a24', 'koreancinema', 'dga', 'nycdirector'],
    unionStatus: 'DGA Member',
    representation: 'ICM Partners',
    availability: ['2024-05', '2024-06'],
    gearList: ['ARRI Alexa Mini', 'Cooke Anamorphics'],
    lastPostDates: []
  },
  {
    id: 'user-6',
    name: 'Emma Williams',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=800&h=450&fit=crop',
    role: 'Actor',
    location: 'London, UK',
    pronouns: 'she/her',
    bio: 'BAFTA-nominated actress with extensive theatre and film experience. RSC trained.',
    badges: ['sag-aftra', 'bafta', 'rsc', 'mocap'],
    unionStatus: 'Equity UK',
    representation: 'Hamilton Hodell',
    availability: ['2024-03', '2024-04'],
    gearList: [],
    lastPostDates: ['2024-01-23', '2024-01-24']
  },
  {
    id: 'user-7',
    name: 'James Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=450&fit=crop',
    role: 'Musician',
    location: 'Austin, TX',
    pronouns: 'he/him',
    bio: 'Session guitarist and live sound engineer. 500+ shows worldwide.',
    badges: ['livemusic', 'sessionmusician', 'audioengineer', 'touring'],
    unionStatus: 'AFM Local 433',
    representation: 'Self-managed',
    availability: ['2024-01', '2024-02', '2024-03'],
    gearList: ['Fender Custom Shop', 'Marshall JCM800', 'Kemper Profiler'],
    lastPostDates: ['2024-01-24']
  },
  {
    id: 'user-8',
    name: 'Olivia Parker',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=450&fit=crop',
    role: 'Producer',
    location: 'Chicago, IL',
    pronouns: 'she/her',
    bio: 'Documentary producer and impact strategist. Emmy winner for social impact films.',
    badges: ['documentary', 'emmy', 'pga', 'socialimpact'],
    unionStatus: 'PGA Member',
    representation: 'Paradigm',
    availability: ['2024-02', '2024-04'],
    gearList: [],
    lastPostDates: ['2024-01-21', '2024-01-22']
  },
  {
    id: 'user-9',
    name: 'Ryan Mitchell',
    avatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=450&fit=crop',
    role: 'Actor',
    location: 'Atlanta, GA',
    pronouns: 'he/him',
    bio: 'Action and stunt performer. Marvel and DC credits. SAG stunt coordinator.',
    badges: ['sag-aftra', 'stuntperformer', 'marvel', 'actionstar'],
    unionStatus: 'SAG-AFTRA',
    representation: 'APA',
    availability: ['2024-01', '2024-02', '2024-03'],
    gearList: [],
    lastPostDates: ['2024-01-20']
  },
  {
    id: 'user-10',
    name: 'Mia Anderson',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=450&fit=crop',
    role: 'Musician',
    location: 'Brooklyn, NY',
    pronouns: 'she/her',
    bio: 'Singer-songwriter and vocal coach. Platinum records and tour credits with major artists.',
    badges: ['vocalist', 'songwriter', 'vocalcoach', 'tourmusician'],
    unionStatus: 'AFM Member',
    representation: 'Red Light Management',
    availability: ['2024-03', '2024-04', '2024-05'],
    gearList: ['Neumann U87', 'Neve 1073', 'Pro Tools'],
    lastPostDates: ['2024-01-22', '2024-01-23', '2024-01-24']
  },
  {
    id: 'user-11',
    name: 'Chris Taylor',
    avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=800&h=450&fit=crop',
    role: 'Director',
    location: 'Portland, OR',
    pronouns: 'they/them',
    bio: 'Commercial and music video director. Worked with Spotify, Apple, Nike.',
    badges: ['musicvideo', 'commercial', 'adfest', 'lgbtq'],
    unionStatus: 'DGA Member',
    representation: 'Independent',
    availability: ['2024-02', '2024-03'],
    gearList: ['Sony FX6', 'Sigma Art Primes'],
    lastPostDates: ['2024-01-24']
  },
  {
    id: 'user-12',
    name: 'Sarah Johnson',
    avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800&h=450&fit=crop',
    role: 'Actor',
    location: 'Vancouver, BC',
    pronouns: 'she/her',
    bio: 'Series regular on multiple network shows. Comedy and drama range.',
    badges: ['sag-aftra', 'actra', 'comedy', 'improv'],
    unionStatus: 'ACTRA / SAG-AFTRA',
    representation: 'Gersh Agency',
    availability: ['2024-04', '2024-05', '2024-06'],
    gearList: [],
    lastPostDates: ['2024-01-21']
  },
  {
    id: 'user-13',
    name: 'Michael Brown',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=450&fit=crop',
    role: 'Producer',
    location: 'San Francisco, CA',
    pronouns: 'he/him',
    bio: 'Tech entrepreneur turned film producer. Focus on sci-fi and tech-adjacent stories.',
    badges: ['scifi', 'techfilm', 'pga', 'startup'],
    unionStatus: 'PGA Member',
    representation: 'CAA',
    availability: ['2024-01', '2024-02'],
    gearList: [],
    lastPostDates: ['2024-01-23', '2024-01-24']
  },
  {
    id: 'user-14',
    name: 'Lisa Wong',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&h=450&fit=crop',
    role: 'Musician',
    location: 'Seattle, WA',
    pronouns: 'she/her',
    bio: 'Classical violinist turned film composer. Orchestral and electronic fusion.',
    badges: ['filmcomposer', 'classical', 'orchestral', 'strings'],
    unionStatus: 'AFM Member',
    representation: 'Soundtrack Music Associates',
    availability: ['2024-02', '2024-03', '2024-04'],
    gearList: ['Stradivarius Copy', 'Logic Pro X', 'Spitfire Audio'],
    lastPostDates: []
  },
  {
    id: 'user-15',
    name: 'Daniel Lee',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&h=450&fit=crop',
    role: 'Director',
    location: 'Toronto, ON',
    pronouns: 'he/him',
    bio: 'TIFF favorite. Horror and thriller specialist.',
    badges: ['horrorproducer', 'tiff', 'dga', 'thriller'],
    unionStatus: 'DGC Ontario',
    representation: 'Verve',
    availability: ['2024-05', '2024-06'],
    gearList: ['Canon C500 Mk II', 'Zeiss CP.3'],
    lastPostDates: ['2024-01-22']
  },
  {
    id: 'user-16',
    name: 'Ashley Garcia',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=450&fit=crop',
    role: 'Actor',
    location: 'Phoenix, AZ',
    pronouns: 'she/her',
    bio: 'Bilingual actress. Telenovela background with crossover success.',
    badges: ['sag-aftra', 'latinxfilm', 'bilingual', 'telenovela'],
    unionStatus: 'SAG-AFTRA',
    representation: 'Buchwald',
    availability: ['2024-01', '2024-02', '2024-03'],
    gearList: [],
    lastPostDates: ['2024-01-24']
  },
  {
    id: 'user-17',
    name: 'Kevin O\'Brien',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=450&fit=crop',
    role: 'Musician',
    location: 'Dublin, Ireland',
    pronouns: 'he/him',
    bio: 'Traditional Irish musician and contemporary score composer.',
    badges: ['traditional', 'celtic', 'filmcomposer', 'worldmusic'],
    unionStatus: 'IMRO',
    representation: 'Independent',
    availability: ['2024-03', '2024-04'],
    gearList: ['Uilleann Pipes', 'Irish Bouzouki', 'Cubase'],
    lastPostDates: ['2024-01-20', '2024-01-21']
  },
  {
    id: 'user-18',
    name: 'Rachel Green',
    avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&h=450&fit=crop',
    role: 'Producer',
    location: 'Boston, MA',
    pronouns: 'she/her',
    bio: 'Animation and VFX producer. Pixar and DreamWorks alumni.',
    badges: ['animation', 'vfx', 'pga', 'pixar'],
    unionStatus: 'PGA Member',
    representation: 'Anonymous Content',
    availability: ['2024-02', '2024-04', '2024-06'],
    gearList: [],
    lastPostDates: ['2024-01-23']
  },
  {
    id: 'user-19',
    name: 'Anthony Davis',
    avatar: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=450&fit=crop',
    role: 'Actor',
    location: 'Detroit, MI',
    pronouns: 'he/him',
    bio: 'Theatre actor transitioning to film. Classically trained.',
    badges: ['theatre', 'sag-aftra', 'shakespeare', 'drama'],
    unionStatus: 'AEA / SAG-AFTRA',
    representation: 'CESD',
    availability: ['2024-01', '2024-02'],
    gearList: [],
    lastPostDates: ['2024-01-22', '2024-01-24']
  },
  {
    id: 'user-20',
    name: 'Nicole Foster',
    avatar: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=200&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&h=450&fit=crop',
    role: 'Director',
    location: 'Denver, CO',
    pronouns: 'she/her',
    bio: 'Documentary filmmaker focused on environmental and social justice.',
    badges: ['documentary', 'socialimpact', 'dga', 'environmental'],
    unionStatus: 'DGA Member',
    representation: 'Cinetic Media',
    availability: ['2024-03', '2024-05'],
    gearList: ['Sony A7S III', 'DJI Mavic 3'],
    lastPostDates: ['2024-01-21', '2024-01-22', '2024-01-23']
  }
];

// Connections setup for user-1 to have 1st, 2nd, 3rd degree connections
export const stubConnections: Connection[] = [
  // User-1's direct connections (1st degree)
  { id: 'conn-1', userAId: 'user-1', userBId: 'user-2', status: 'accepted', createdAt: '2024-01-01' },
  { id: 'conn-2', userAId: 'user-1', userBId: 'user-3', status: 'accepted', createdAt: '2024-01-02' },
  { id: 'conn-3', userAId: 'user-1', userBId: 'user-4', status: 'accepted', createdAt: '2024-01-03' },
  { id: 'conn-4', userAId: 'user-1', userBId: 'user-5', status: 'accepted', createdAt: '2024-01-04' },
  { id: 'conn-5', userAId: 'user-6', userBId: 'user-1', status: 'pending', createdAt: '2024-01-05' },
  
  // User-2's connections (creates 2nd degree for user-1)
  { id: 'conn-6', userAId: 'user-2', userBId: 'user-7', status: 'accepted', createdAt: '2024-01-06' },
  { id: 'conn-7', userAId: 'user-2', userBId: 'user-8', status: 'accepted', createdAt: '2024-01-07' },
  { id: 'conn-8', userAId: 'user-2', userBId: 'user-9', status: 'accepted', createdAt: '2024-01-08' },
  
  // User-3's connections (creates 2nd degree for user-1)
  { id: 'conn-9', userAId: 'user-3', userBId: 'user-10', status: 'accepted', createdAt: '2024-01-09' },
  { id: 'conn-10', userAId: 'user-3', userBId: 'user-11', status: 'accepted', createdAt: '2024-01-10' },
  
  // User-7's connections (creates 3rd degree for user-1)
  { id: 'conn-11', userAId: 'user-7', userBId: 'user-12', status: 'accepted', createdAt: '2024-01-11' },
  { id: 'conn-12', userAId: 'user-7', userBId: 'user-13', status: 'accepted', createdAt: '2024-01-12' },
  { id: 'conn-13', userAId: 'user-7', userBId: 'user-14', status: 'accepted', createdAt: '2024-01-13' },
  
  // User-8's connections (creates 3rd degree for user-1)
  { id: 'conn-14', userAId: 'user-8', userBId: 'user-15', status: 'accepted', createdAt: '2024-01-14' },
  { id: 'conn-15', userAId: 'user-8', userBId: 'user-16', status: 'accepted', createdAt: '2024-01-15' },
  
  // User-10's connections (creates 3rd degree for user-1)
  { id: 'conn-16', userAId: 'user-10', userBId: 'user-17', status: 'accepted', createdAt: '2024-01-16' },
  { id: 'conn-17', userAId: 'user-10', userBId: 'user-18', status: 'accepted', createdAt: '2024-01-17' },
  
  // More connections for variety
  { id: 'conn-18', userAId: 'user-4', userBId: 'user-13', status: 'accepted', createdAt: '2024-01-18' },
  { id: 'conn-19', userAId: 'user-5', userBId: 'user-15', status: 'accepted', createdAt: '2024-01-19' },
  { id: 'conn-20', userAId: 'user-11', userBId: 'user-19', status: 'accepted', createdAt: '2024-01-20' },
  { id: 'conn-21', userAId: 'user-12', userBId: 'user-20', status: 'accepted', createdAt: '2024-01-21' },
];

export const stubMaterials: Material[] = [
  // User-1 photos
  { id: 'mat-1', userId: 'user-1', type: 'photo', url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600', name: 'On Set', visibility: 'public', order: 1, createdAt: '2024-01-01' },
  { id: 'mat-2', userId: 'user-1', type: 'photo', url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600', name: 'Premiere', visibility: 'public', order: 2, createdAt: '2024-01-02' },
  { id: 'mat-3', userId: 'user-1', type: 'photo', url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600', name: 'Award Show', visibility: 'connections', order: 3, createdAt: '2024-01-03' },
  
  // User-1 reels
  { id: 'mat-4', userId: 'user-1', type: 'reel', url: 'https://example.com/reel1.mp4', name: 'Director Reel 2024', visibility: 'public', order: 1, createdAt: '2024-01-04' },
  
  // User-2 materials
  { id: 'mat-5', userId: 'user-2', type: 'photo', url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=600', name: 'Headshot', visibility: 'public', order: 1, createdAt: '2024-01-05' },
  { id: 'mat-6', userId: 'user-2', type: 'photo', url: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=600', name: 'Stage Photo', visibility: 'public', order: 2, createdAt: '2024-01-06' },
];

export const stubCredits: Credit[] = [
  // User-1 credits
  { id: 'cred-1', userId: 'user-1', project: 'Moonlight Shadows', role: 'Director', year: 2023, company: 'A24', verified: true },
  { id: 'cred-2', userId: 'user-1', project: 'The Last Sunset', role: 'Director', year: 2022, company: 'Focus Features', verified: true },
  { id: 'cred-3', userId: 'user-1', project: 'Urban Dreams', role: 'Director', year: 2021, company: 'Indie Film Co', verified: false },
  { id: 'cred-4', userId: 'user-1', project: 'Silent Streets', role: 'Co-Director', year: 2020, company: 'Neon', verified: true },
  
  // User-2 credits
  { id: 'cred-5', userId: 'user-2', project: 'Hamilton', role: 'Ensemble', year: 2022, company: 'Broadway', verified: true },
  { id: 'cred-6', userId: 'user-2', project: 'Dear Evan Hansen', role: 'Alana Beck', year: 2021, company: 'Broadway', verified: true },
  { id: 'cred-7', userId: 'user-2', project: 'Law & Order', role: 'Guest Star', year: 2023, company: 'NBC', verified: false },
  
  // User-3 credits
  { id: 'cred-8', userId: 'user-3', project: 'Stranger Things S4', role: 'Additional Music', year: 2022, company: 'Netflix', verified: true },
  { id: 'cred-9', userId: 'user-3', project: 'Blade Runner 2099', role: 'Composer', year: 2024, company: 'Amazon Studios', verified: false },
];

// Sample stories - expires 24 hours from a recent time
const getExpiryTime = (hoursFromNow: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
};

const getCreatedTime = (hoursAgo: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
};

export const stubStories: Story[] = [
  // User-2 stories (Jordan Chen - Actor)
  {
    id: 'story-1',
    userId: 'user-2',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=540&h=960&fit=crop',
    caption: 'Backstage vibes 🎭',
    createdAt: getCreatedTime(2),
    expiresAt: getExpiryTime(22),
    viewedBy: []
  },
  {
    id: 'story-2',
    userId: 'user-2',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=540&h=960&fit=crop',
    caption: 'Opening night! ✨',
    createdAt: getCreatedTime(1),
    expiresAt: getExpiryTime(23),
    viewedBy: []
  },
  // User-3 stories (Marcus Thompson - Musician)
  {
    id: 'story-3',
    userId: 'user-3',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=540&h=960&fit=crop',
    caption: 'New track cooking 🎹',
    createdAt: getCreatedTime(4),
    expiresAt: getExpiryTime(20),
    viewedBy: []
  },
  // User-4 stories (Sofia Martinez - Producer)
  {
    id: 'story-4',
    userId: 'user-4',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=540&h=960&fit=crop',
    caption: 'On set with the crew',
    createdAt: getCreatedTime(6),
    expiresAt: getExpiryTime(18),
    viewedBy: []
  },
  {
    id: 'story-5',
    userId: 'user-4',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=540&h=960&fit=crop',
    caption: 'Wrap day! 🎬',
    createdAt: getCreatedTime(3),
    expiresAt: getExpiryTime(21),
    viewedBy: []
  },
  // User-6 stories (Emma Williams - Actor)
  {
    id: 'story-6',
    userId: 'user-6',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=540&h=960&fit=crop',
    caption: 'London calling 🇬🇧',
    createdAt: getCreatedTime(5),
    expiresAt: getExpiryTime(19),
    viewedBy: []
  },
  // User-10 stories (Mia Anderson - Musician)
  {
    id: 'story-7',
    userId: 'user-10',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=540&h=960&fit=crop',
    caption: 'Studio session 🎤',
    createdAt: getCreatedTime(1),
    expiresAt: getExpiryTime(23),
    viewedBy: []
  },
];

// Stub threads and messages for user-1's connections
export const stubThreads: Thread[] = [
  {
    id: 'thread-1',
    participants: ['user-1', 'user-2'],
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 mins ago
  },
  {
    id: 'thread-2',
    participants: ['user-1', 'user-3'],
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
  },
  {
    id: 'thread-3',
    participants: ['user-1', 'user-4'],
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
  }
];

export const stubMessages: Message[] = [
  // Thread 1: user-1 and user-2
  {
    id: 'msg-1',
    threadId: 'thread-1',
    senderId: 'user-2',
    content: 'Hey Alex! Saw your latest short film - absolutely stunning cinematography!',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString()
  },
  {
    id: 'msg-2',
    threadId: 'thread-1',
    senderId: 'user-1',
    content: 'Thanks Jordan! That means a lot coming from you. How\'s the Broadway run going?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString()
  },
  {
    id: 'msg-3',
    threadId: 'thread-1',
    senderId: 'user-2',
    content: 'It\'s been amazing! We just extended the run through March. Would love to have you come see it!',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
  },
  {
    id: 'msg-4',
    threadId: 'thread-1',
    senderId: 'user-1',
    content: 'I\'d love that! I\'ll be in NYC next month for a meeting with A24.',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
  },
  {
    id: 'msg-5',
    threadId: 'thread-1',
    senderId: 'user-2',
    content: 'Perfect timing! Let\'s grab dinner after the show 🎭',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  
  // Thread 2: user-1 and user-3
  {
    id: 'msg-6',
    threadId: 'thread-2',
    senderId: 'user-1',
    content: 'Marcus! I need a composer for my next project. Are you available in March?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
  },
  {
    id: 'msg-7',
    threadId: 'thread-2',
    senderId: 'user-3',
    content: 'Alex! Great to hear from you. March is looking good actually. What\'s the project?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
  },
  {
    id: 'msg-8',
    threadId: 'thread-2',
    senderId: 'user-1',
    content: 'It\'s a psychological thriller with some horror elements. Think Ari Aster meets Denis Villeneuve.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: 'msg-9',
    threadId: 'thread-2',
    senderId: 'user-3',
    content: 'That sounds right up my alley! I\'ve been experimenting with some dark ambient textures. Let\'s set up a call to discuss.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  
  // Thread 3: user-1 and user-4
  {
    id: 'msg-10',
    threadId: 'thread-3',
    senderId: 'user-4',
    content: 'Just got funding approved for our project! 🎉',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString()
  },
  {
    id: 'msg-11',
    threadId: 'thread-3',
    senderId: 'user-1',
    content: 'That\'s incredible news Sofia! Congratulations! When do we start pre-production?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 46).toISOString()
  },
  {
    id: 'msg-12',
    threadId: 'thread-3',
    senderId: 'user-4',
    content: 'I\'m thinking we kick off in February. I\'ll send over the updated timeline tomorrow.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString()
  }
];

// Stub events
const getEventDate = (daysFromNow: number, hour: number = 18) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const stubEvents: Event[] = [
  {
    id: 'event-1',
    title: 'Indie Filmmakers Networking Night',
    description: 'Connect with fellow indie filmmakers, share your latest projects, and find potential collaborators for your next production.',
    type: 'networking',
    location: 'Los Angeles, CA',
    address: 'The Writers Room, 6777 Hollywood Blvd',
    date: getEventDate(3, 19),
    hostId: 'user-1',
    coverImage: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-2', status: 'going' },
      { userId: 'user-4', status: 'going' },
      { userId: 'user-5', status: 'interested' },
      { userId: 'user-7', status: 'going' },
    ],
    tags: ['indie', 'networking', 'filmmakers', 'la'],
    isVirtual: false,
  },
  {
    id: 'event-2',
    title: 'Acting Workshop: Method Techniques',
    description: 'Deep dive into method acting techniques with acclaimed acting coach Sarah Mitchell. Limited spots available.',
    type: 'workshop',
    location: 'New York, NY',
    address: 'Actors Studio, 432 W 44th St',
    date: getEventDate(5, 14),
    endDate: getEventDate(5, 18),
    hostId: 'user-2',
    coverImage: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-6', status: 'going' },
      { userId: 'user-9', status: 'going' },
      { userId: 'user-12', status: 'going' },
      { userId: 'user-16', status: 'interested' },
      { userId: 'user-19', status: 'going' },
    ],
    tags: ['acting', 'workshop', 'method', 'technique'],
    isVirtual: false,
    capacity: 20,
  },
  {
    id: 'event-3',
    title: 'Documentary Film Screening: "Voices Unheard"',
    description: 'Special screening of the award-winning documentary followed by Q&A with the director.',
    type: 'screening',
    location: 'Chicago, IL',
    address: 'Music Box Theatre, 3733 N Southport Ave',
    date: getEventDate(7, 20),
    hostId: 'user-8',
    coverImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-1', status: 'interested' },
      { userId: 'user-4', status: 'going' },
      { userId: 'user-13', status: 'going' },
      { userId: 'user-20', status: 'going' },
    ],
    tags: ['documentary', 'screening', 'chicago', 'socialimpact'],
    isVirtual: false,
  },
  {
    id: 'event-4',
    title: 'Virtual Open Audition: Sci-Fi Feature',
    description: 'Casting call for supporting roles in upcoming sci-fi feature. Self-tape submissions welcome.',
    type: 'audition',
    location: 'Virtual',
    address: '',
    date: getEventDate(2, 10),
    endDate: getEventDate(2, 16),
    hostId: 'user-13',
    coverImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-2', status: 'going' },
      { userId: 'user-6', status: 'going' },
      { userId: 'user-9', status: 'interested' },
      { userId: 'user-12', status: 'going' },
      { userId: 'user-16', status: 'going' },
      { userId: 'user-19', status: 'going' },
    ],
    tags: ['audition', 'scifi', 'casting', 'virtual'],
    isVirtual: true,
    virtualLink: 'https://zoom.us/j/example',
  },
  {
    id: 'event-5',
    title: 'Film Composers Meetup',
    description: 'Monthly gathering for film composers to share work, discuss techniques, and network.',
    type: 'meetup',
    location: 'Nashville, TN',
    address: 'Sound Stage Studios, 10 Music Circle S',
    date: getEventDate(10, 18),
    hostId: 'user-3',
    coverImage: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-7', status: 'going' },
      { userId: 'user-10', status: 'going' },
      { userId: 'user-14', status: 'interested' },
      { userId: 'user-17', status: 'going' },
    ],
    tags: ['music', 'composers', 'film', 'nashville'],
    isVirtual: false,
  },
  {
    id: 'event-6',
    title: 'Entertainment Industry Conference 2024',
    description: 'Annual conference featuring panels, workshops, and networking with industry leaders.',
    type: 'conference',
    location: 'Los Angeles, CA',
    address: 'LA Convention Center, 1201 S Figueroa St',
    date: getEventDate(14, 9),
    endDate: getEventDate(16, 18),
    hostId: 'user-4',
    coverImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-1', status: 'going' },
      { userId: 'user-2', status: 'interested' },
      { userId: 'user-3', status: 'going' },
      { userId: 'user-5', status: 'going' },
      { userId: 'user-8', status: 'going' },
      { userId: 'user-11', status: 'interested' },
      { userId: 'user-13', status: 'going' },
      { userId: 'user-18', status: 'going' },
    ],
    tags: ['conference', 'industry', 'networking', 'panels'],
    isVirtual: false,
  },
  {
    id: 'event-7',
    title: 'Virtual Screenwriting Workshop',
    description: 'Learn the fundamentals of screenwriting from WGA members. Perfect for beginners.',
    type: 'workshop',
    location: 'Virtual',
    address: '',
    date: getEventDate(4, 15),
    endDate: getEventDate(4, 17),
    hostId: 'user-1',
    coverImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-5', status: 'going' },
      { userId: 'user-11', status: 'going' },
      { userId: 'user-15', status: 'interested' },
    ],
    tags: ['screenwriting', 'workshop', 'wga', 'virtual'],
    isVirtual: true,
    virtualLink: 'https://meet.google.com/example',
    capacity: 50,
  },
  {
    id: 'event-8',
    title: 'SAG-AFTRA Members Mixer',
    description: 'Exclusive networking event for SAG-AFTRA members. Bring your union card!',
    type: 'networking',
    location: 'New York, NY',
    address: 'SAG-AFTRA Plaza, 5757 Wilshire Blvd',
    date: getEventDate(8, 18),
    hostId: 'user-2',
    coverImage: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=400&fit=crop',
    attendees: [
      { userId: 'user-6', status: 'going' },
      { userId: 'user-9', status: 'going' },
      { userId: 'user-12', status: 'going' },
      { userId: 'user-16', status: 'interested' },
      { userId: 'user-19', status: 'going' },
    ],
    tags: ['sagaftra', 'union', 'networking', 'actors'],
    isVirtual: false,
  },
];

// Stub opportunities
export const stubOpportunities: Opportunity[] = [
  {
    id: 'opp-1',
    title: 'Lead Actor for Indie Feature Film',
    description: 'Seeking a dynamic lead actor for an indie drama about a musician rediscovering their passion. Must have experience with dramatic roles and be comfortable with on-set improvisation.',
    type: 'casting',
    status: 'open',
    postedBy: 'user-4',
    company: 'Sundance Films',
    location: 'Los Angeles, CA',
    isRemote: false,
    compensation: '$500/day + backend points',
    experienceLevel: 'intermediate',
    roles: ['Actor'],
    requirements: ['SAG-AFTRA membership', '3+ years acting experience', 'Musical instrument ability preferred'],
    deadline: '2026-02-15',
    startDate: '2026-03-01',
    duration: '6 weeks',
    applicants: [
      { userId: 'user-2', appliedAt: '2026-01-05', status: 'reviewed' },
      { userId: 'user-6', appliedAt: '2026-01-07', status: 'pending' },
    ],
    tags: ['indiefilm', 'drama', 'leadrole', 'sagaftra', 'losangeles'],
    createdAt: '2026-01-02',
    isFeatured: true,
  },
  {
    id: 'opp-2',
    title: 'Film Composer for Horror Short',
    description: 'Looking for a composer to create an atmospheric, tension-building score for a 20-minute horror short. Style reference: Ari Aster films.',
    type: 'gig',
    status: 'open',
    postedBy: 'user-15',
    company: 'Midnight Productions',
    location: 'Remote',
    isRemote: true,
    compensation: '$2,000 flat fee',
    experienceLevel: 'any',
    roles: ['Musician'],
    requirements: ['Portfolio of horror/thriller scores', 'Quick turnaround capability'],
    deadline: '2026-01-25',
    duration: '3 weeks',
    applicants: [
      { userId: 'user-3', appliedAt: '2026-01-08', status: 'accepted' },
    ],
    tags: ['horror', 'filmcomposer', 'shortfilm', 'remote', 'score'],
    createdAt: '2026-01-05',
    isFeatured: false,
  },
  {
    id: 'opp-3',
    title: 'Production Assistant - Major Studio Feature',
    description: 'Entry-level PA position on upcoming action feature. Great opportunity to learn from industry professionals on a major studio production.',
    type: 'job',
    status: 'open',
    postedBy: 'user-8',
    company: 'Universal Pictures',
    location: 'Atlanta, GA',
    isRemote: false,
    compensation: '$200/day',
    experienceLevel: 'entry',
    roles: ['Producer'],
    requirements: ['Valid drivers license', 'Reliable transportation', 'Ability to work long hours'],
    deadline: '2026-02-01',
    startDate: '2026-02-15',
    duration: '4 months',
    applicants: [],
    tags: ['production', 'entrylevel', 'studio', 'atlanta', 'feature'],
    createdAt: '2026-01-08',
    isFeatured: true,
  },
  {
    id: 'opp-4',
    title: 'Director for Music Video - Emerging Artist',
    description: 'Seeking a visionary director for upcoming music video. Budget is modest but creative freedom is high. Looking for bold visual storytelling.',
    type: 'collaboration',
    status: 'open',
    postedBy: 'user-10',
    location: 'New York, NY',
    isRemote: false,
    compensation: '$1,500 + points',
    experienceLevel: 'intermediate',
    roles: ['Director'],
    requirements: ['Music video reel', 'Creative pitch required', 'NYC availability'],
    deadline: '2026-01-30',
    duration: '1 week shoot',
    applicants: [
      { userId: 'user-11', appliedAt: '2026-01-09', status: 'pending' },
    ],
    tags: ['musicvideo', 'nyc', 'creative', 'indie', 'visualart'],
    createdAt: '2026-01-06',
    isFeatured: false,
  },
  {
    id: 'opp-5',
    title: 'Voice Actor for Animation Series',
    description: 'Casting multiple voice actors for new adult animated comedy series. Various character types needed including lead and supporting roles.',
    type: 'casting',
    status: 'open',
    postedBy: 'user-18',
    company: 'DreamWorks Animation',
    location: 'Remote',
    isRemote: true,
    compensation: 'Union Scale',
    experienceLevel: 'senior',
    roles: ['Actor'],
    requirements: ['Voice acting demo reel', 'SAG-AFTRA or willing to join', 'Home studio setup'],
    deadline: '2026-02-28',
    applicants: [
      { userId: 'user-2', appliedAt: '2026-01-10', status: 'pending' },
    ],
    tags: ['voiceover', 'animation', 'comedy', 'series', 'remote'],
    createdAt: '2026-01-09',
    isFeatured: true,
  },
  {
    id: 'opp-6',
    title: 'Session Guitarist for Album Recording',
    description: 'Looking for versatile session guitarist for indie rock album. 10-track project, studio is in Austin. Must be comfortable with various styles.',
    type: 'gig',
    status: 'open',
    postedBy: 'user-7',
    location: 'Austin, TX',
    isRemote: false,
    compensation: '$400/track',
    experienceLevel: 'intermediate',
    roles: ['Musician'],
    requirements: ['Session experience', 'Own quality gear', 'Sight reading ability'],
    deadline: '2026-01-20',
    startDate: '2026-01-25',
    duration: '2 weeks',
    applicants: [],
    tags: ['guitar', 'session', 'recording', 'indierock', 'austin'],
    createdAt: '2026-01-04',
    isFeatured: false,
  },
  {
    id: 'opp-7',
    title: 'Documentary Producer - Climate Change Series',
    description: 'Seeking experienced documentary producer for 6-part climate series. International travel required. Passion for environmental issues essential.',
    type: 'job',
    status: 'open',
    postedBy: 'user-20',
    company: 'National Geographic',
    location: 'Washington, DC',
    isRemote: false,
    compensation: '$8,000/week',
    experienceLevel: 'senior',
    roles: ['Producer'],
    requirements: ['Documentary producing credits', 'Passport valid for international travel', 'Field production experience'],
    deadline: '2026-02-10',
    startDate: '2026-03-01',
    duration: '18 months',
    applicants: [
      { userId: 'user-8', appliedAt: '2026-01-08', status: 'reviewed' },
    ],
    tags: ['documentary', 'climate', 'natgeo', 'producer', 'travel'],
    createdAt: '2026-01-03',
    isFeatured: true,
  },
  {
    id: 'opp-8',
    title: 'Stunt Double - Action Feature',
    description: 'Seeking stunt double for male lead in action feature. Must have martial arts training and be comfortable with wire work.',
    type: 'casting',
    status: 'open',
    postedBy: 'user-4',
    company: 'Marvel Studios',
    location: 'Atlanta, GA',
    isRemote: false,
    compensation: 'SAG Scale + hazard pay',
    experienceLevel: 'senior',
    roles: ['Actor'],
    requirements: ['Stunt coordinator certification', 'Martial arts black belt', 'Previous film stunt work'],
    deadline: '2026-01-18',
    startDate: '2026-02-01',
    duration: '3 months',
    applicants: [
      { userId: 'user-9', appliedAt: '2026-01-06', status: 'accepted' },
    ],
    tags: ['stunts', 'action', 'marvel', 'atlanta', 'wirework'],
    createdAt: '2026-01-01',
    isFeatured: false,
  },
  {
    id: 'opp-9',
    title: 'Director of Photography - Feature Film',
    description: 'Award-winning director seeking DP for character-driven drama. Shooting on film. Previous feature experience required.',
    type: 'job',
    status: 'open',
    postedBy: 'user-1',
    company: 'A24',
    location: 'Los Angeles, CA',
    isRemote: false,
    compensation: '$3,500/day',
    experienceLevel: 'senior',
    roles: ['Director'],
    requirements: ['Feature film DP credits', 'Film camera experience', 'Available for prep and principal'],
    deadline: '2026-02-05',
    startDate: '2026-03-15',
    duration: '8 weeks',
    applicants: [
      { userId: 'user-5', appliedAt: '2026-01-09', status: 'pending' },
    ],
    tags: ['cinematography', 'dp', 'a24', 'film', 'feature'],
    createdAt: '2026-01-07',
    isFeatured: true,
  },
  {
    id: 'opp-10',
    title: 'Background Actors - Period Drama',
    description: 'Seeking background actors of all ages for 1920s period drama. No experience necessary but period-appropriate look preferred.',
    type: 'casting',
    status: 'open',
    postedBy: 'user-13',
    company: 'HBO',
    location: 'New York, NY',
    isRemote: false,
    compensation: '$200/day',
    experienceLevel: 'entry',
    roles: ['Actor'],
    requirements: ['Available for multiple shoot days', 'Period-appropriate look', 'No visible tattoos'],
    deadline: '2026-01-22',
    startDate: '2026-02-01',
    duration: '2 weeks',
    applicants: [],
    tags: ['background', 'hbo', 'perioddrama', 'nyc', 'extras'],
    createdAt: '2026-01-10',
    isFeatured: false,
  },
];

// Initialize store with stub data
export function initializeStubData(set: (partial: Partial<{
  users: User[];
  materials: Material[];
  credits: Credit[];
  connections: Connection[];
  stories: Story[];
  messages: Message[];
  threads: Thread[];
  events: Event[];
  opportunities: Opportunity[];
}>) => void) {
  set({
    users: stubUsers,
    materials: stubMaterials,
    credits: stubCredits,
    connections: stubConnections,
    stories: stubStories,
    messages: stubMessages,
    threads: stubThreads,
    events: stubEvents,
    opportunities: stubOpportunities,
  });
}
