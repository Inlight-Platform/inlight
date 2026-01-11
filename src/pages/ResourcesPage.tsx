import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Building2, Film } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Category = 'All' | 'News' | 'Directories' | 'Education' | 'Union' | 'Casting' | 'Scripts';

interface ResourceItem {
  name: string;
  description: string;
  url: string;
  category: Category;
}

interface DirectoryItem {
  name: string;
  url: string;
  specialty?: string;
}

const categories: Category[] = ['All', 'News', 'Directories', 'Education', 'Union', 'Casting', 'Scripts'];

const theatreResources: ResourceItem[] = [
  { name: "Playbill", description: "Broadway news, reviews, and show listings", url: "https://www.playbill.com", category: "News" },
  { name: "Broadway World", description: "Comprehensive theatre news and job board", url: "https://www.broadwayworld.com", category: "News" },
  { name: "Actors' Equity", description: "Union resources for stage actors and managers", url: "https://www.actorsequity.org", category: "Union" },
  { name: "Backstage", description: "Casting calls and audition notices", url: "https://www.backstage.com", category: "Casting" },
  { name: "Theatre Communications Group", description: "Grants, internships, and professional development", url: "https://www.tcg.org", category: "Education" },
  { name: "Samuel French", description: "Play scripts and licensing information", url: "https://www.samuelfrench.com", category: "Scripts" },
  { name: "The Stage", description: "UK and international theatre industry news", url: "https://www.thestage.co.uk", category: "News" },
  { name: "American Theatre Wing", description: "Educational programs and Tony Awards info", url: "https://americantheatrewing.org", category: "Education" },
  { name: "New Play Exchange", description: "Database of new plays by living writers", url: "https://newplayexchange.org", category: "Scripts" },
];

const filmResources: ResourceItem[] = [
  { name: "IMDbPro", description: "Industry contacts and production tracking", url: "https://pro.imdb.com", category: "Directories" },
  { name: "Variety", description: "Entertainment industry news and analysis", url: "https://variety.com", category: "News" },
  { name: "The Black List", description: "Screenplay hosting and industry access", url: "https://blcklst.com", category: "Scripts" },
  { name: "SAG-AFTRA", description: "Union membership and actor resources", url: "https://www.sagaftra.org", category: "Union" },
  { name: "Film Independent", description: "Grants, labs, and Spirit Awards programs", url: "https://www.filmindependent.org", category: "Education" },
  { name: "No Film School", description: "Filmmaking tutorials and industry insights", url: "https://nofilmschool.com", category: "Education" },
  { name: "Stage 32", description: "Networking platform for film professionals", url: "https://www.stage32.com", category: "Directories" },
  { name: "Mandy.com", description: "Crew jobs and casting opportunities", url: "https://www.mandy.com", category: "Casting" },
  { name: "Deadline", description: "Breaking entertainment news and deals", url: "https://deadline.com", category: "News" },
  { name: "Sundance Co//ab", description: "Educational courses from Sundance Institute", url: "https://collab.sundance.org", category: "Education" },
];

const nycTalentAgencies: DirectoryItem[] = [
  { name: "William Morris Endeavor (WME)", url: "https://www.wmeagency.com", specialty: "Full-service" },
  { name: "Creative Artists Agency (CAA)", url: "https://www.caa.com", specialty: "Full-service" },
  { name: "United Talent Agency (UTA)", url: "https://www.unitedtalent.com", specialty: "Full-service" },
  { name: "ICM Partners", url: "https://www.icmpartners.com", specialty: "Full-service" },
  { name: "Paradigm Talent Agency", url: "https://www.paradigmagency.com", specialty: "Full-service" },
  { name: "Abrams Artists Agency", url: "https://www.abramsartists.com", specialty: "Theatre & TV" },
  { name: "Gersh Agency", url: "https://www.gershagency.com", specialty: "Full-service" },
  { name: "APA (Agency for the Performing Arts)", url: "https://www.apa-agency.com", specialty: "Full-service" },
  { name: "Stewart Talent", url: "https://www.stewarttalent.com", specialty: "Commercial & Print" },
  { name: "CESD Talent Agency", url: "https://www.cesdtalent.com", specialty: "Voice-over & On-camera" },
  { name: "Don Buchwald & Associates", url: "https://www.buchwald.com", specialty: "Broadcast & Voice" },
  { name: "Innovative Artists", url: "https://www.innovativeartists.com", specialty: "Full-service" },
  { name: "DGRW (Douglas, Gorman, Rothacker & Wilhelm)", url: "https://www.dfrw.com", specialty: "Theatre" },
  { name: "Harden-Curtis Associates", url: "https://www.hardencurtis.com", specialty: "Theatre & Musical" },
  { name: "Telsey + Company", url: "https://www.telseyandco.com", specialty: "Casting" },
];

const nycFilmProductionCompanies: DirectoryItem[] = [
  { name: "A24", url: "https://a24films.com", specialty: "Independent Film" },
  { name: "Killer Films", url: "https://www.killerfilms.com", specialty: "Independent Film" },
  { name: "Scott Rudin Productions", url: "https://www.scottrudin.com", specialty: "Film & Theatre" },
  { name: "Annapurna Pictures", url: "https://www.annapurnapics.com", specialty: "Feature Films" },
  { name: "Big Beach", url: "https://www.bigbeachfilms.com", specialty: "Independent Film" },
  { name: "Likely Story", url: "https://www.likelystory.com", specialty: "Feature Films" },
  { name: "Plan B Entertainment", url: "https://www.planbentertainment.com", specialty: "Feature Films" },
  { name: "Bow and Arrow Entertainment", url: "https://www.bowandarrowent.com", specialty: "Feature Films" },
  { name: "Glass Eye Pix", url: "https://www.glasseyepix.com", specialty: "Horror & Indie" },
  { name: "Sikelia Productions", url: "https://www.sikeliaproductions.com", specialty: "Documentary" },
  { name: "RadicalMedia", url: "https://www.radicalmedia.com", specialty: "Commercials & Docs" },
  { name: "Tribeca Productions", url: "https://www.tribecafilm.com", specialty: "Feature Films" },
  { name: "Cinereach", url: "https://www.cinereach.org", specialty: "Independent Film" },
  { name: "Blumhouse Productions", url: "https://www.blumhouse.com", specialty: "Horror & Thriller" },
  { name: "FilmNation Entertainment", url: "https://www.filmnation.com", specialty: "International Sales" },
];

const getCategoryColor = (category: Category): string => {
  switch (category) {
    case 'News': return 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30';
    case 'Directories': return 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30';
    case 'Education': return 'bg-green-500/20 text-green-300 hover:bg-green-500/30';
    case 'Union': return 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30';
    case 'Casting': return 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/30';
    case 'Scripts': return 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

const ResourceCard: React.FC<{ resource: ResourceItem; variant: 'theatre' | 'film' }> = ({ resource, variant }) => {
  return (
    <a 
      href={resource.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block group"
    >
      <Card className={`
        transition-all duration-300 border-0
        ${variant === 'theatre' 
          ? 'bg-rose-950/40 hover:bg-rose-900/50 hover:shadow-lg hover:shadow-rose-500/10' 
          : 'bg-slate-800/60 hover:bg-slate-700/70 hover:shadow-lg hover:shadow-cyan-500/10'
        }
      `}>
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`
                font-semibold text-base group-hover:underline underline-offset-2
                ${variant === 'theatre' ? 'text-rose-100' : 'text-cyan-100'}
              `}>
                {resource.name}
              </h3>
              <Badge variant="secondary" className={`text-xs px-2 py-0 ${getCategoryColor(resource.category)}`}>
                {resource.category}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {resource.description}
            </p>
          </div>
          <ExternalLink className={`
            w-4 h-4 flex-shrink-0 mt-1 opacity-50 group-hover:opacity-100 transition-opacity
            ${variant === 'theatre' ? 'text-rose-300' : 'text-cyan-300'}
          `} />
        </CardContent>
      </Card>
    </a>
  );
};

const DirectoryDropdown: React.FC<{
  items: DirectoryItem[];
  placeholder: string;
  variant: 'theatre' | 'film';
  icon: React.ReactNode;
}> = ({ items, placeholder, variant, icon }) => {
  const [selectedUrl, setSelectedUrl] = useState<string>('');

  const handleSelect = (url: string) => {
    setSelectedUrl(url);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Select value={selectedUrl} onValueChange={handleSelect}>
      <SelectTrigger className={`
        w-full border-0 
        ${variant === 'theatre' 
          ? 'bg-rose-950/60 text-rose-100 hover:bg-rose-900/70' 
          : 'bg-slate-800/80 text-cyan-100 hover:bg-slate-700/90'
        }
      `}>
        <div className="flex items-center gap-2">
          {icon}
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent className="z-50 max-h-80 bg-popover border border-border">
        {items.map((item) => (
          <SelectItem key={item.name} value={item.url} className="cursor-pointer">
            <div className="flex flex-col">
              <span className="font-medium">{item.name}</span>
              {item.specialty && (
                <span className="text-xs text-muted-foreground">{item.specialty}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const FilterChips: React.FC<{
  activeFilter: Category;
  onFilterChange: (category: Category) => void;
  variant: 'theatre' | 'film';
}> = ({ activeFilter, onFilterChange, variant }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onFilterChange(category)}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
            ${activeFilter === category
              ? variant === 'theatre'
                ? 'bg-rose-500 text-white'
                : 'bg-cyan-500 text-white'
              : variant === 'theatre'
                ? 'bg-rose-950/50 text-rose-200 hover:bg-rose-900/60'
                : 'bg-slate-700/50 text-cyan-200 hover:bg-slate-600/60'
            }
          `}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

const ResourcesPage: React.FC = () => {
  const navigate = useNavigate();
  const [theatreFilter, setTheatreFilter] = useState<Category>('All');
  const [filmFilter, setFilmFilter] = useState<Category>('All');

  const filteredTheatreResources = theatreFilter === 'All' 
    ? theatreResources 
    : theatreResources.filter(r => r.category === theatreFilter);

  const filteredFilmResources = filmFilter === 'All' 
    ? filmResources 
    : filmResources.filter(r => r.category === filmFilter);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-display font-bold">Resources for Students</h1>
        </div>
      </header>

      {/* Main Content - Two Columns */}
      <main className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-73px)]">
        {/* Theatre Column */}
        <section 
          className="relative p-6 lg:p-8"
          style={{
            background: 'linear-gradient(135deg, hsl(350 40% 12%) 0%, hsl(350 30% 8%) 50%, hsl(350 25% 5%) 100%)',
          }}
        >
          {/* Curtain texture overlay */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(
                90deg,
                transparent,
                transparent 20px,
                hsl(350 50% 30%) 20px,
                hsl(350 50% 30%) 22px
              )`,
            }}
          />
          
          <div className="relative z-10">
            <h2 className="text-3xl font-display font-bold text-rose-200 mb-4 tracking-wide">
              THEATRE
            </h2>
            
            {/* Directory Dropdown */}
            <div className="mb-4">
              <DirectoryDropdown
                items={nycTalentAgencies}
                placeholder="NYC Talent Agencies Directory"
                variant="theatre"
                icon={<Building2 className="w-4 h-4" />}
              />
            </div>
            
            {/* Filter Chips */}
            <FilterChips 
              activeFilter={theatreFilter} 
              onFilterChange={setTheatreFilter} 
              variant="theatre" 
            />
            
            <div className="space-y-3">
              {filteredTheatreResources.length > 0 ? (
                filteredTheatreResources.map((resource) => (
                  <ResourceCard key={resource.name} resource={resource} variant="theatre" />
                ))
              ) : (
                <p className="text-rose-300/60 text-center py-4">No resources in this category</p>
              )}
            </div>
          </div>
        </section>

        {/* Film Column */}
        <section 
          className="relative p-6 lg:p-8"
          style={{
            background: 'linear-gradient(135deg, hsl(210 20% 8%) 0%, hsl(210 15% 5%) 50%, hsl(220 20% 3%) 100%)',
          }}
        >
          {/* Film strip texture overlay */}
          <div 
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 40px,
                  hsl(200 50% 50%) 40px,
                  hsl(200 50% 50%) 42px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 60px,
                  hsl(200 30% 40%) 60px,
                  hsl(200 30% 40%) 62px
                )
              `,
            }}
          />
          
          {/* Film sprocket holes */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-6 opacity-5 pointer-events-none hidden lg:block"
            style={{
              backgroundImage: `repeating-linear-gradient(
                180deg,
                transparent,
                transparent 30px,
                hsl(0 0% 100%) 30px,
                hsl(0 0% 100%) 50px,
                transparent 50px,
                transparent 60px
              )`,
            }}
          />
          
          <div className="relative z-10">
            <h2 className="text-3xl font-display font-bold text-cyan-200 mb-4 tracking-wide">
              FILM
            </h2>
            
            {/* Directory Dropdown */}
            <div className="mb-4">
              <DirectoryDropdown
                items={nycFilmProductionCompanies}
                placeholder="NYC Film Production Companies"
                variant="film"
                icon={<Film className="w-4 h-4" />}
              />
            </div>
            
            {/* Filter Chips */}
            <FilterChips 
              activeFilter={filmFilter} 
              onFilterChange={setFilmFilter} 
              variant="film" 
            />
            
            <div className="space-y-3">
              {filteredFilmResources.length > 0 ? (
                filteredFilmResources.map((resource) => (
                  <ResourceCard key={resource.name} resource={resource} variant="film" />
                ))
              ) : (
                <p className="text-cyan-300/60 text-center py-4">No resources in this category</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ResourcesPage;
