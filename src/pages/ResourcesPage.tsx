import React, { useState } from 'react';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { ExternalLink, GraduationCap, Mic, Music, Video, Theater, Building2, Film, Bookmark, BookmarkCheck, Guitar } from 'lucide-react';
import { useSavedItems } from '@/hooks/useSavedItems';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type ResourceCategory = 'news' | 'directories' | 'education' | 'union' | 'casting' | 'scripts';

interface ResourceItem {
  name: string;
  description: string;
  url: string;
  category: ResourceCategory;
}

interface CategoryCard {
  id: ResourceCategory;
  name: string;
  description: string;
  icon: string;
}

interface EducationProgram {
  name: string;
  description: string;
  url: string;
  type: 'acting' | 'filmmaking' | 'producing' | 'dance' | 'voice' | 'instrument' | 'songwriting' | 'production' | 'general';
  industry: 'theatre' | 'film' | 'music' | 'both';
}

const resourceCategories: CategoryCard[] = [
  { id: 'news', name: 'Industry News', description: 'Latest updates', icon: '📰' },
  { id: 'directories', name: 'Directories', description: 'Find contacts', icon: '📇' },
  { id: 'education', name: 'Education', description: 'Learn & grow', icon: '🎓' },
  { id: 'union', name: 'Unions', description: 'Professional orgs', icon: '🛡️' },
  { id: 'casting', name: 'Casting', description: 'Find work', icon: '🎭' },
  { id: 'scripts', name: 'Scripts', description: 'Read & submit', icon: '📜' },
];

const theatreResources: ResourceItem[] = [
  { name: "Playbill", description: "Broadway news, reviews, and show listings", url: "https://www.playbill.com", category: "news" },
  { name: "Broadway World", description: "Comprehensive theatre news and job board", url: "https://www.broadwayworld.com", category: "news" },
  { name: "The Stage", description: "UK and international theatre industry news", url: "https://www.thestage.co.uk", category: "news" },
  { name: "Actors' Equity", description: "Union resources for stage actors and managers", url: "https://www.actorsequity.org", category: "union" },
  { name: "Backstage", description: "Casting calls and audition notices", url: "https://www.backstage.com", category: "casting" },
  { name: "Theatre Communications Group", description: "Grants, internships, and professional development", url: "https://www.tcg.org", category: "education" },
  { name: "Samuel French", description: "Play scripts and licensing information", url: "https://www.samuelfrench.com", category: "scripts" },
  { name: "American Theatre Wing", description: "Educational programs and Tony Awards info", url: "https://americantheatrewing.org", category: "education" },
  { name: "New Play Exchange", description: "Database of new plays by living writers", url: "https://newplayexchange.org", category: "scripts" },
  { name: "NYC Talent Agencies", description: "Find representation in New York", url: "#", category: "directories" },
  // NYC-focused additions
  { name: "The Broadway League", description: "Trade association for the Broadway industry in NYC", url: "https://www.broadwayleague.com", category: "directories" },
  { name: "TDF (Theatre Development Fund)", description: "TKTS booth, audience programs, and NYC theatre resources", url: "https://www.tdf.org", category: "directories" },
  { name: "Off-Broadway League", description: "Association of Off-Broadway producers and theatres", url: "https://www.offbroadway.org", category: "directories" },
  { name: "A.R.T./New York", description: "Service org supporting 400+ NYC nonprofit theatres", url: "https://www.art-newyork.org", category: "directories" },
  { name: "New York Theatre Workshop", description: "Off-Broadway hub for new work and artist residencies", url: "https://www.nytw.org", category: "directories" },
  { name: "The Public Theater", description: "Iconic NYC theatre with EWG and Public Forum programs", url: "https://publictheater.org", category: "directories" },
  { name: "SDC (Stage Directors & Choreographers)", description: "Union for theatrical directors and choreographers", url: "https://sdcweb.org", category: "union" },
  { name: "IATSE Local One", description: "NYC stagehands and theatrical employees union", url: "https://www.iatselocalone.org", category: "union" },
  { name: "Local 802 AFM", description: "NYC musicians' union covering Broadway pits", url: "https://www.local802afm.org", category: "union" },
  { name: "Actors Access", description: "Free casting submissions for NYC actors", url: "https://www.actorsaccess.com", category: "casting" },
  { name: "Casting Networks", description: "Audition listings used by NYC casting directors", url: "https://www.castingnetworks.com", category: "casting" },
  { name: "Playbill Casting Call", description: "NYC theatre auditions and EPAs", url: "https://www.playbill.com/job/casting-call", category: "casting" },
  { name: "Dramatists Play Service", description: "Licensing and acting editions for plays", url: "https://www.dramatists.com", category: "scripts" },
  { name: "Dramatists Guild of America", description: "Membership org for playwrights, composers, and lyricists", url: "https://www.dramatistsguild.com", category: "scripts" },
  { name: "The Drama Book Shop", description: "Legendary NYC bookstore for plays and theatre books", url: "https://www.dramabookshop.com", category: "scripts" },
  { name: "Lincoln Center Theater", description: "Resident NYC company with LCT3 emerging artist program", url: "https://www.lct.org", category: "directories" },
  { name: "Roundabout Theatre Company", description: "NYC nonprofit Broadway and Off-Broadway company", url: "https://www.roundabouttheatre.org", category: "directories" },
  { name: "Manhattan Theatre Club", description: "Tony-winning NYC company producing new plays", url: "https://www.manhattantheatreclub.com", category: "directories" },
  { name: "Signature Theatre NYC", description: "Playwright-in-residence model in Hell's Kitchen", url: "https://www.signaturetheatre.org", category: "directories" },
  { name: "Ars Nova", description: "NYC incubator for emerging theatre, comedy, and music artists", url: "https://arsnovanyc.com", category: "directories" },
  { name: "Lark Play Development Center Archive", description: "Archive of new play development resources", url: "https://www.larktheatre.org", category: "scripts" },
];

const filmResources: ResourceItem[] = [
  { name: "IMDbPro", description: "Industry contacts and production tracking", url: "https://pro.imdb.com", category: "directories" },
  { name: "Variety", description: "Entertainment industry news and analysis", url: "https://variety.com", category: "news" },
  { name: "Deadline", description: "Breaking entertainment news and deals", url: "https://deadline.com", category: "news" },
  { name: "The Black List", description: "Screenplay hosting and industry access", url: "https://blcklst.com", category: "scripts" },
  { name: "SAG-AFTRA", description: "Union membership and actor resources", url: "https://www.sagaftra.org", category: "union" },
  { name: "Film Independent", description: "Grants, labs, and Spirit Awards programs", url: "https://www.filmindependent.org", category: "education" },
  { name: "No Film School", description: "Filmmaking tutorials and industry insights", url: "https://nofilmschool.com", category: "education" },
  { name: "Stage 32", description: "Networking platform for film professionals", url: "https://www.stage32.com", category: "directories" },
  { name: "Mandy.com", description: "Crew jobs and casting opportunities", url: "https://www.mandy.com", category: "casting" },
  { name: "Sundance Co//ab", description: "Educational courses from Sundance Institute", url: "https://collab.sundance.org", category: "education" },
  // NYC-focused additions
  { name: "Mayor's Office of Media & Entertainment (MOME)", description: "NYC film permits and production resources", url: "https://www.nyc.gov/site/mome/index.page", category: "directories" },
  { name: "Made in NY", description: "NYC production incentives, jobs, and training programs", url: "https://www.nyc.gov/site/mome/initiatives/made-in-ny.page", category: "directories" },
  { name: "Brooklyn Filmmakers Collective", description: "Indie filmmaker community in Brooklyn", url: "https://www.brooklynfilmmakerscollective.com", category: "directories" },
  { name: "Rooftop Films", description: "NYC's outdoor indie film series and grants program", url: "https://rooftopfilms.com", category: "directories" },
  { name: "DCTV (Downtown Community Television)", description: "Documentary filmmaking nonprofit in Chinatown", url: "https://www.dctvny.org", category: "education" },
  { name: "UnionDocs", description: "Brooklyn-based documentary art center and residency", url: "https://uniondocs.org", category: "education" },
  { name: "Tribeca Film Institute Alumni Network", description: "Resources for NYC indie filmmakers", url: "https://tribecafilm.com", category: "directories" },
  { name: "Film Forum", description: "Iconic NYC indie cinema and screening venue", url: "https://filmforum.org", category: "directories" },
  { name: "IFC Center", description: "Greenwich Village arthouse and Doc Fortnight venue", url: "https://www.ifccenter.com", category: "directories" },
  { name: "BAM (Brooklyn Academy of Music) Cinema", description: "Brooklyn arthouse and BAMcinemaFest organizer", url: "https://www.bam.org/film", category: "directories" },
  { name: "Directors Guild of America - Eastern Region", description: "DGA membership for NYC directors and AD/UPMs", url: "https://www.dga.org", category: "union" },
  { name: "Writers Guild of America East", description: "WGAE represents NYC screen and TV writers", url: "https://www.wgaeast.org", category: "union" },
  { name: "IATSE Local 600", description: "Cinematographers Guild covering NYC camera crews", url: "https://www.icg600.com", category: "union" },
  { name: "IATSE Local 52", description: "NYC studio mechanics covering grip, electric, and props", url: "https://www.iatselocal52.org", category: "union" },
  { name: "Backstage NYC Film Casting", description: "NYC film and TV audition listings", url: "https://www.backstage.com/casting/new-york-ny", category: "casting" },
  { name: "Project Casting", description: "Background and principal casting for NYC productions", url: "https://www.projectcasting.com", category: "casting" },
  { name: "Coverfly", description: "Screenplay hosting and competition tracker", url: "https://writers.coverfly.com", category: "scripts" },
  { name: "Final Draft", description: "Industry-standard screenwriting software and resources", url: "https://www.finaldraft.com", category: "scripts" },
  { name: "IndieWire", description: "Independent film news and craft coverage", url: "https://www.indiewire.com", category: "news" },
  { name: "The Hollywood Reporter", description: "Entertainment industry news and analysis", url: "https://www.hollywoodreporter.com", category: "news" },
  { name: "Filmmaker Magazine", description: "IFP's quarterly magazine for indie filmmakers", url: "https://filmmakermagazine.com", category: "news" },
];

const musicResources: ResourceItem[] = [
  // News
  { name: "Billboard", description: "Charts, music industry news, and analysis", url: "https://www.billboard.com", category: "news" },
  { name: "Pitchfork", description: "Album reviews and music criticism", url: "https://pitchfork.com", category: "news" },
  { name: "Rolling Stone", description: "Music news, interviews, and features", url: "https://www.rollingstone.com/music", category: "news" },
  { name: "Music Business Worldwide", description: "Global music business news and deal-making", url: "https://www.musicbusinessworldwide.com", category: "news" },
  { name: "Hypebot", description: "Music industry news for indie artists and managers", url: "https://www.hypebot.com", category: "news" },
  // Unions
  { name: "Local 802 AFM", description: "NYC musicians' union (Broadway pits, recording, live)", url: "https://www.local802afm.org", category: "union" },
  { name: "AFM (American Federation of Musicians)", description: "National union for professional musicians", url: "https://www.afm.org", category: "union" },
  { name: "SAG-AFTRA Singers", description: "Union representation for recording artists and singers", url: "https://www.sagaftra.org", category: "union" },
  { name: "ASCAP", description: "Performing rights organization for songwriters", url: "https://www.ascap.com", category: "union" },
  { name: "BMI", description: "Performing rights organization for songwriters and composers", url: "https://www.bmi.com", category: "union" },
  { name: "SESAC", description: "Invitation-only performing rights organization", url: "https://www.sesac.com", category: "union" },
  // Directories / venues
  { name: "NYC Venue Guide (Oh My Rockness)", description: "Indie show listings and venues across NYC", url: "https://www.ohmyrockness.com", category: "directories" },
  { name: "Bowery Presents", description: "Promoter behind many top NYC venues (Bowery Ballroom, Music Hall of Williamsburg)", url: "https://www.bowerypresents.com", category: "directories" },
  { name: "Brooklyn Steel", description: "Major Brooklyn live music venue", url: "https://www.bowerypresents.com/brooklyn-steel", category: "directories" },
  { name: "Joe's Pub at The Public", description: "Iconic NYC cabaret and listening room", url: "https://publictheater.org/programs/joes-pub", category: "directories" },
  { name: "Lincoln Center", description: "Classical, jazz, and contemporary music programming", url: "https://www.lincolncenter.org", category: "directories" },
  { name: "Carnegie Hall", description: "Legendary NYC concert hall and education programs", url: "https://www.carnegiehall.org", category: "directories" },
  { name: "Jazz at Lincoln Center", description: "Jazz performance, education, and Dizzy's Club", url: "https://www.jazz.org", category: "directories" },
  { name: "Smalls Jazz Club", description: "Greenwich Village jam session institution", url: "https://www.smallslive.com", category: "directories" },
  { name: "Village Vanguard", description: "Historic NYC jazz club hosting nightly sets", url: "https://villagevanguard.com", category: "directories" },
  { name: "Rough Trade NYC", description: "Brooklyn record store and intimate live venue", url: "https://www.roughtradenyc.com", category: "directories" },
  { name: "Elsewhere", description: "Bushwick multi-room venue for indie and electronic", url: "https://www.elsewherebrooklyn.com", category: "directories" },
  // Education
  { name: "Juilliard Evening Division", description: "Continuing music education from Juilliard", url: "https://evening.juilliard.edu", category: "education" },
  { name: "Manhattan School of Music Precollege & Continuing Ed", description: "Classical and jazz training in NYC", url: "https://www.msmnyc.edu", category: "education" },
  { name: "The New School - College of Performing Arts", description: "Jazz, classical, and contemporary music degrees", url: "https://www.newschool.edu/performing-arts", category: "education" },
  { name: "Berklee NYC", description: "Berklee's NYC campus focused on music production", url: "https://www.berklee.edu/nyc", category: "education" },
  { name: "Dubspot Online", description: "Electronic music production and DJ courses", url: "https://www.dubspot.com", category: "education" },
  // Casting / opportunities
  { name: "Sonicbids", description: "Submit to festivals, gigs, and licensing opportunities", url: "https://www.sonicbids.com", category: "casting" },
  { name: "ReverbNation Opportunities", description: "Gigs, sync, and label opportunities for artists", url: "https://www.reverbnation.com/opportunities", category: "casting" },
  { name: "Backstage Music Auditions", description: "NYC music and musical theatre audition listings", url: "https://www.backstage.com/casting/musicians-singers", category: "casting" },
  // Scripts / publishing
  { name: "Songtrust", description: "Publishing administration and royalty collection", url: "https://www.songtrust.com" , category: "scripts" },
  { name: "DistroKid", description: "Independent music distribution to streaming platforms", url: "https://distrokid.com", category: "scripts" },
  { name: "TuneCore", description: "Music distribution and publishing administration", url: "https://www.tunecore.com", category: "scripts" },
  { name: "Bandcamp for Artists", description: "Direct-to-fan sales and artist resources", url: "https://bandcamp.com/artists", category: "scripts" },
];

const educationPrograms: EducationProgram[] = [
  // Acting
  { name: "Stella Adler Studio", description: "Renowned acting conservatory with technique-based training", url: "https://stellaadler.com", type: "acting", industry: "both" },
  { name: "Lee Strasberg Theatre & Film Institute", description: "Method acting training for stage and screen", url: "https://strasberg.edu", type: "acting", industry: "both" },
  { name: "Atlantic Theater Company", description: "Practical Aesthetics acting technique training", url: "https://atlantictheater.org/atlantic-acting-school/", type: "acting", industry: "theatre" },
  { name: "William Esper Studio", description: "Meisner Technique training program", url: "https://www.esperstudio.com", type: "acting", industry: "both" },
  { name: "HB Studio", description: "Affordable acting classes in Greenwich Village", url: "https://hbstudio.org", type: "acting", industry: "both" },
  { name: "Susan Batson Studio", description: "Private coaching and intensive workshops", url: "https://susanbatson.com", type: "acting", industry: "film" },
  
  // Filmmaking
  { name: "New York Film Academy", description: "Hands-on filmmaking courses and degrees", url: "https://www.nyfa.edu", type: "filmmaking", industry: "film" },
  { name: "Manhattan Edit Workshop", description: "Editing, post-production, and DIT training", url: "https://www.mewshop.com", type: "filmmaking", industry: "film" },
  { name: "Gotham Film & Media Institute", description: "Classes for emerging screenwriters and filmmakers", url: "https://gotham.org", type: "filmmaking", industry: "film" },
  { name: "IFP (Independent Filmmaker Project)", description: "Labs, workshops, and filmmaker support", url: "https://www.ifp.org", type: "filmmaking", industry: "film" },
  
  // Producing
  { name: "Commercial Theater Institute", description: "Broadway producing intensive program", url: "https://www.commercialtheaterinstitute.com", type: "producing", industry: "theatre" },
  { name: "Producers Guild of America", description: "Workshops and mentorship for producers", url: "https://producersguild.org", type: "producing", industry: "film" },
  { name: "The Producer's Perspective", description: "Broadway producing resources and courses", url: "https://www.theproducersperspective.com", type: "producing", industry: "theatre" },
  
  // Dance
  { name: "Steps on Broadway", description: "Open dance classes for all levels", url: "https://stepsnyc.com", type: "dance", industry: "theatre" },
  { name: "Broadway Dance Center", description: "Professional dance training in NYC", url: "https://broadwaydancecenter.com", type: "dance", industry: "theatre" },
  { name: "Peridance Capezio Center", description: "Ballet, contemporary, and commercial dance", url: "https://peridance.com", type: "dance", industry: "both" },
  { name: "Alvin Ailey Extension", description: "Open classes from the renowned dance company", url: "https://www.alvinailey.org/extension", type: "dance", industry: "both" },
  
  // Voice
  { name: "New York Vocal Coaching", description: "Private voice lessons and group classes", url: "https://newyorkvocalcoaching.com", type: "voice", industry: "both" },
  { name: "Singing for Actors", description: "Musical theatre vocal technique", url: "https://singingforactors.com", type: "voice", industry: "theatre" },
  { name: "Voice Teacher NYC", description: "Professional voice training directory", url: "https://voiceteachernyc.com", type: "voice", industry: "both" },
  { name: "Matt Farnsworth Vocal Studios", description: "Contemporary and MT voice lessons", url: "https://www.mattfarnsworthvocalstudios.com", type: "voice", industry: "theatre" },

  // Music — Instrument
  { name: "Brooklyn Music School", description: "Private lessons across instruments in Fort Greene", url: "https://www.brooklynmusicschool.org", type: "instrument", industry: "music" },
  { name: "Bloomingdale School of Music", description: "UWS community music school for all ages", url: "https://www.bsmny.org", type: "instrument", industry: "music" },
  { name: "Greenwich House Music School", description: "Private and group lessons in the West Village", url: "https://www.greenwichhouse.org/music-school", type: "instrument", industry: "music" },
  { name: "Diller-Quaile School of Music", description: "Classical training rooted in Dalcroze approach", url: "https://www.diller-quaile.org", type: "instrument", industry: "music" },
  { name: "Turtle Bay Music School", description: "Midtown East community music school", url: "https://www.tbms.org", type: "instrument", industry: "music" },

  // Music — Voice
  { name: "NYC Vocal Studio (Justin Stoney)", description: "Contemporary commercial voice training", url: "https://newyorkvocalcoaching.com", type: "voice", industry: "music" },
  { name: "The Voice Studio NYC", description: "Pop, rock, and R&B voice technique", url: "https://thevoicestudionyc.com", type: "voice", industry: "music" },

  // Music — Songwriting
  { name: "BMI Songwriters Workshop", description: "Free Brooklyn-based workshops for songwriters", url: "https://www.bmi.com/genres/entry/the-bmi-lehman-engel-musical-theatre-workshop", type: "songwriting", industry: "music" },
  { name: "ASCAP Music Creator Programs", description: "Workshops for songwriters and composers", url: "https://www.ascap.com/music-creators", type: "songwriting", industry: "music" },
  { name: "The Songwriter's Studio NYC", description: "Songwriting coaching and group classes", url: "https://www.thesongwritersstudio.com", type: "songwriting", industry: "music" },

  // Music — Production
  { name: "Dubspot Online", description: "Ableton, Logic, and DJ certification courses", url: "https://www.dubspot.com", type: "production", industry: "music" },
  { name: "Berklee NYC - Power Station", description: "Master's in music production at the historic studio", url: "https://www.berklee.edu/nyc", type: "production", industry: "music" },
  { name: "Beat Lab Academy", description: "Beatmaking and electronic production classes", url: "https://beatlabacademy.com", type: "production", industry: "music" },
  { name: "Institute of Audio Research (IAR)", description: "Audio engineering certificate program in NYC", url: "https://www.audiosc.com", type: "production", industry: "music" },

  // Music — Voice/Instrument crossover
  { name: "The New School - Mannes Prep", description: "Pre-college classical training", url: "https://www.newschool.edu/mannes/preparatory-division", type: "instrument", industry: "music" },
  { name: "Jazz at Lincoln Center Education", description: "Workshops and Swing University for jazz students", url: "https://academy.jazz.org", type: "instrument", industry: "music" },
];

const getEducationTypeIcon = (type: EducationProgram['type']) => {
  switch (type) {
    case 'acting': return <Theater className="w-4 h-4" />;
    case 'filmmaking': return <Video className="w-4 h-4" />;
    case 'producing': return <Building2 className="w-4 h-4" />;
    case 'dance': return <Music className="w-4 h-4" />;
    case 'voice': return <Mic className="w-4 h-4" />;
    case 'instrument': return <Guitar className="w-4 h-4" />;
    case 'songwriting': return <Music className="w-4 h-4" />;
    case 'production': return <Mic className="w-4 h-4" />;
    default: return <GraduationCap className="w-4 h-4" />;
  }
};

const getEducationTypeName = (type: EducationProgram['type']) => {
  switch (type) {
    case 'acting': return 'Acting';
    case 'filmmaking': return 'Filmmaking';
    case 'producing': return 'Producing';
    case 'dance': return 'Dance';
    case 'voice': return 'Voice';
    case 'instrument': return 'Instrument';
    case 'songwriting': return 'Songwriting';
    case 'production': return 'Production';
    default: return 'General';
  }
};

const ResourcesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'theatre' | 'film' | 'music'>('theatre');
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | null>(null);
  const [educationFilter, setEducationFilter] = useState<EducationProgram['type'] | 'all'>('all');
  const { isSaved, toggleSave } = useSavedItems();

  const { data: dbResources } = useQuery({
    queryKey: ['public-resources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resources for the current industry tab (non-education entries).
  // 'both' industry rows show up in Theatre and Film.
  const currentResources: ResourceItem[] = (dbResources ?? [])
    .filter((r: any) => !r.is_education)
    .filter((r: any) =>
      r.industry === activeTab ||
      (r.industry === 'both' && activeTab !== 'music')
    )
    .map((r: any) => ({
      name: r.name,
      description: r.description ?? '',
      url: r.url,
      category: (r.category as ResourceCategory) ?? 'directories',
    }));

  // Education programs sourced from DB.
  const dbEducation: EducationProgram[] = (dbResources ?? [])
    .filter((r: any) => r.is_education)
    .map((r: any) => ({
      name: r.name,
      description: r.description ?? '',
      url: r.url,
      type: ((r.education_type as EducationProgram['type']) ?? 'general'),
      industry: ((r.industry as EducationProgram['industry']) ?? 'both'),
    }));
  // Filter out education from regular resources since it has its own section
  const filteredResources = selectedCategory 
    ? selectedCategory === 'education' 
      ? [] // Education is handled separately
      : currentResources.filter(r => r.category === selectedCategory)
    : currentResources.filter(r => r.category !== 'education');

  const filteredEducation = dbEducation.filter(p => {
    const industryMatch = p.industry === 'both' || p.industry === activeTab;
    const typeMatch = educationFilter === 'all' || p.type === educationFilter;
    return industryMatch && typeMatch;
  });

  const educationTypesByTab: Record<typeof activeTab, EducationProgram['type'][]> = {
    theatre: ['acting', 'producing', 'dance', 'voice'],
    film: ['acting', 'filmmaking', 'producing'],
    music: ['instrument', 'voice', 'songwriting', 'production'],
  };
  const educationTypes = educationTypesByTab[activeTab];

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 sm:px-8 lg:px-10 py-4">
          <div className="flex items-center gap-4">
            <img
              src={inlightLogo}
              alt="Inlight"
              className="w-10 h-10 rounded-full object-cover"
            />
            <h1 className="text-2xl font-display font-bold">Resources</h1>
          </div>
        </div>
      </header>
      
      <div className="px-6 sm:px-8 lg:px-10 py-6">
        {/* Industry Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as 'theatre' | 'film' | 'music');
            setSelectedCategory(null);
            setEducationFilter('all');
          }}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="theatre" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
              <Theater className="w-4 h-4" />
              Theatre
            </TabsTrigger>
            <TabsTrigger value="film" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
              <Film className="w-4 h-4" />
              Film
            </TabsTrigger>
            <TabsTrigger value="music" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
              <Music className="w-4 h-4" />
              Music
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theatre" className="space-y-8">
            {/* Categories Grid */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📚</span>
                <h2 className="text-lg font-display font-semibold">Browse by Category</h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {resourceCategories.map((cat) => (
                  <Card
                    key={cat.id}
                    className={`cursor-pointer transition-colors group ${
                      selectedCategory === cat.id 
                        ? 'bg-primary/20 border-primary' 
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">
                        {cat.icon}
                      </span>
                      <h3 className="font-semibold text-xs mb-0.5 line-clamp-1">
                        {cat.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {cat.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Education & Programs Section - shown when education is selected */}
            {selectedCategory === 'education' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-display font-semibold">Education & Programs</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Find workshops, classes, and training programs outside of college
                </p>
                
                {/* Education Type Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setEducationFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      educationFilter === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    All
                  </button>
                  {educationTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setEducationFilter(type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                        educationFilter === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {getEducationTypeIcon(type)}
                      {getEducationTypeName(type)}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredEducation.map((program) => {
                    const saved = isSaved('resource', program.name, program.url);
                    return (
                      <div key={program.name} className="relative block group">
                        <a href={program.url} target="_blank" rel="noopener noreferrer" className="block">
                          <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold group-hover:text-primary transition-colors">{program.name}</h3>
                                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{program.description}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  {getEducationTypeIcon(program.type)}
                                  {getEducationTypeName(program.type)}
                                </Badge>
                                {program.industry !== 'both' && (
                                <Badge variant="outline" className="text-xs capitalize">{program.industry}</Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave({ item_type: 'resource', item_title: program.name, item_url: program.url, item_metadata: { description: program.description, category: 'education' } }); }}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Resources List - shown when not education */}
            {selectedCategory !== 'education' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold">
                    {selectedCategory 
                      ? resourceCategories.find(c => c.id === selectedCategory)?.name 
                      : 'All Resources'}
                  </h2>
                  {selectedCategory && (
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className="text-sm text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredResources.map((resource) => {
                    const saved = isSaved('resource', resource.name, resource.url);
                    return (
                      <div key={resource.name} className="relative block group">
                        <a 
                          href={resource.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold group-hover:text-primary transition-colors">
                                  {resource.name}
                                </h3>
                                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {resource.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs">
                                  {resourceCategories.find(c => c.id === resource.category)?.name}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSave({
                              item_type: 'resource',
                              item_title: resource.name,
                              item_url: resource.url,
                              item_metadata: { description: resource.description, category: resource.category },
                            });
                          }}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          {saved ? (
                            <BookmarkCheck className="w-4 h-4 text-primary" />
                          ) : (
                            <Bookmark className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="film" className="space-y-8">
            {/* Categories Grid */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📚</span>
                <h2 className="text-lg font-display font-semibold">Browse by Category</h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {resourceCategories.map((cat) => (
                  <Card
                    key={cat.id}
                    className={`cursor-pointer transition-colors group ${
                      selectedCategory === cat.id 
                        ? 'bg-primary/20 border-primary' 
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">
                        {cat.icon}
                      </span>
                      <h3 className="font-semibold text-xs mb-0.5 line-clamp-1">
                        {cat.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {cat.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Education & Programs Section - shown when education is selected */}
            {selectedCategory === 'education' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-display font-semibold">Education & Programs</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Find workshops, classes, and training programs outside of college
                </p>
                
                {/* Education Type Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setEducationFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      educationFilter === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    All
                  </button>
                  {educationTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setEducationFilter(type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                        educationFilter === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {getEducationTypeIcon(type)}
                      {getEducationTypeName(type)}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredEducation.map((program) => {
                    const saved = isSaved('resource', program.name, program.url);
                    return (
                      <div key={program.name} className="relative block group">
                        <a href={program.url} target="_blank" rel="noopener noreferrer" className="block">
                          <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold group-hover:text-primary transition-colors">{program.name}</h3>
                                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{program.description}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  {getEducationTypeIcon(program.type)}
                                  {getEducationTypeName(program.type)}
                                </Badge>
                                {program.industry !== 'both' && (
                                  <Badge variant="outline" className="text-xs capitalize">{program.industry}</Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave({ item_type: 'resource', item_title: program.name, item_url: program.url, item_metadata: { description: program.description, category: 'education' } }); }}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Resources List - shown when not education */}
            {selectedCategory !== 'education' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold">
                    {selectedCategory 
                      ? resourceCategories.find(c => c.id === selectedCategory)?.name 
                      : 'All Resources'}
                  </h2>
                  {selectedCategory && (
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className="text-sm text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredResources.map((resource) => {
                    const saved = isSaved('resource', resource.name, resource.url);
                    return (
                      <div key={resource.name} className="relative block group">
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block">
                          <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold group-hover:text-primary transition-colors">{resource.name}</h3>
                                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{resource.description}</p>
                              <Badge variant="secondary" className="text-xs">
                                {resourceCategories.find(c => c.id === resource.category)?.name}
                              </Badge>
                            </CardContent>
                          </Card>
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave({ item_type: 'resource', item_title: resource.name, item_url: resource.url, item_metadata: { description: resource.description, category: resource.category } }); }}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="music" className="space-y-8">
            {/* Categories Grid */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📚</span>
                <h2 className="text-lg font-display font-semibold">Browse by Category</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {resourceCategories.map((cat) => (
                  <Card
                    key={cat.id}
                    className={`cursor-pointer transition-colors group ${
                      selectedCategory === cat.id
                        ? 'bg-primary/20 border-primary'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">
                        {cat.icon}
                      </span>
                      <h3 className="font-semibold text-xs mb-0.5 line-clamp-1">
                        {cat.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {cat.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Education & Programs Section */}
            {selectedCategory === 'education' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-display font-semibold">Education & Programs</h2>
                  </div>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Find lessons, studios, and music training programs in NYC
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setEducationFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      educationFilter === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    All
                  </button>
                  {educationTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setEducationFilter(type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                        educationFilter === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {getEducationTypeIcon(type)}
                      {getEducationTypeName(type)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredEducation.map((program) => {
                    const saved = isSaved('resource', program.name, program.url);
                    return (
                      <div key={program.name} className="relative block group">
                        <a href={program.url} target="_blank" rel="noopener noreferrer" className="block">
                          <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold group-hover:text-primary transition-colors">{program.name}</h3>
                                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{program.description}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  {getEducationTypeIcon(program.type)}
                                  {getEducationTypeName(program.type)}
                                </Badge>
                                {program.industry !== 'both' && (
                                  <Badge variant="outline" className="text-xs capitalize">{program.industry}</Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave({ item_type: 'resource', item_title: program.name, item_url: program.url, item_metadata: { description: program.description, category: 'education' } }); }}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Resources List */}
            {selectedCategory !== 'education' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold">
                    {selectedCategory
                      ? resourceCategories.find(c => c.id === selectedCategory)?.name
                      : 'All Resources'}
                  </h2>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-sm text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {filteredResources.map((resource) => {
                    const saved = isSaved('resource', resource.name, resource.url);
                    return (
                      <div key={resource.name} className="relative block group">
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block">
                          <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold group-hover:text-primary transition-colors">{resource.name}</h3>
                                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{resource.description}</p>
                              <Badge variant="secondary" className="text-xs">
                                {resourceCategories.find(c => c.id === resource.category)?.name}
                              </Badge>
                            </CardContent>
                          </Card>
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave({ item_type: 'resource', item_title: resource.name, item_url: resource.url, item_metadata: { description: resource.description, category: resource.category } }); }}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          {saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ResourcesPage;
