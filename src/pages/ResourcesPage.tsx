import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ResourceItem {
  name: string;
  description: string;
  url: string;
}

const theatreResources: ResourceItem[] = [
  { name: "Playbill", description: "Broadway news, reviews, and show listings", url: "https://www.playbill.com" },
  { name: "Broadway World", description: "Comprehensive theatre news and job board", url: "https://www.broadwayworld.com" },
  { name: "Actors' Equity", description: "Union resources for stage actors and managers", url: "https://www.actorsequity.org" },
  { name: "Backstage", description: "Casting calls and audition notices", url: "https://www.backstage.com" },
  { name: "Theatre Communications Group", description: "Grants, internships, and professional development", url: "https://www.tcg.org" },
  { name: "Samuel French", description: "Play scripts and licensing information", url: "https://www.samuelfrench.com" },
  { name: "The Stage", description: "UK and international theatre industry news", url: "https://www.thestage.co.uk" },
  { name: "American Theatre Wing", description: "Educational programs and Tony Awards info", url: "https://americantheatrewing.org" },
  { name: "New Play Exchange", description: "Database of new plays by living writers", url: "https://newplayexchange.org" },
];

const filmResources: ResourceItem[] = [
  { name: "IMDbPro", description: "Industry contacts and production tracking", url: "https://pro.imdb.com" },
  { name: "Variety", description: "Entertainment industry news and analysis", url: "https://variety.com" },
  { name: "The Black List", description: "Screenplay hosting and industry access", url: "https://blcklst.com" },
  { name: "SAG-AFTRA", description: "Union membership and actor resources", url: "https://www.sagaftra.org" },
  { name: "Film Independent", description: "Grants, labs, and Spirit Awards programs", url: "https://www.filmindependent.org" },
  { name: "No Film School", description: "Filmmaking tutorials and industry insights", url: "https://nofilmschool.com" },
  { name: "Stage 32", description: "Networking platform for film professionals", url: "https://www.stage32.com" },
  { name: "Mandy.com", description: "Crew jobs and casting opportunities", url: "https://www.mandy.com" },
  { name: "Deadline", description: "Breaking entertainment news and deals", url: "https://deadline.com" },
  { name: "Sundance Co//ab", description: "Educational courses from Sundance Institute", url: "https://collab.sundance.org" },
];

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
            <h3 className={`
              font-semibold text-base mb-1 group-hover:underline underline-offset-2
              ${variant === 'theatre' ? 'text-rose-100' : 'text-cyan-100'}
            `}>
              {resource.name}
            </h3>
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

const ResourcesPage: React.FC = () => {
  const navigate = useNavigate();

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
            <h2 className="text-3xl font-display font-bold text-rose-200 mb-6 tracking-wide">
              THEATRE
            </h2>
            <div className="space-y-3">
              {theatreResources.map((resource) => (
                <ResourceCard key={resource.name} resource={resource} variant="theatre" />
              ))}
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
            <h2 className="text-3xl font-display font-bold text-cyan-200 mb-6 tracking-wide">
              FILM
            </h2>
            <div className="space-y-3">
              {filmResources.map((resource) => (
                <ResourceCard key={resource.name} resource={resource} variant="film" />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ResourcesPage;
