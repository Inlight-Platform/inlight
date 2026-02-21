import React, { useState } from 'react';
import { BookOpen, ExternalLink, GraduationCap, Mic, Music, Video, Theater, Building2, Film, Newspaper, Users, FileText, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

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
  type: 'acting' | 'filmmaking' | 'producing' | 'dance' | 'voice' | 'general';
  industry: 'theatre' | 'film' | 'both';
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
];

const getEducationTypeIcon = (type: EducationProgram['type']) => {
  switch (type) {
    case 'acting': return <Theater className="w-4 h-4" />;
    case 'filmmaking': return <Video className="w-4 h-4" />;
    case 'producing': return <Building2 className="w-4 h-4" />;
    case 'dance': return <Music className="w-4 h-4" />;
    case 'voice': return <Mic className="w-4 h-4" />;
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
    default: return 'General';
  }
};

const ResourcesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'theatre' | 'film'>('theatre');
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | null>(null);
  const [educationFilter, setEducationFilter] = useState<EducationProgram['type'] | 'all'>('all');

  const currentResources = activeTab === 'theatre' ? theatreResources : filmResources;
  // Filter out education from regular resources since it has its own section
  const filteredResources = selectedCategory 
    ? selectedCategory === 'education' 
      ? [] // Education is handled separately
      : currentResources.filter(r => r.category === selectedCategory)
    : currentResources.filter(r => r.category !== 'education');

  const filteredEducation = educationPrograms.filter(p => {
    const industryMatch = p.industry === 'both' || p.industry === activeTab;
    const typeMatch = educationFilter === 'all' || p.type === educationFilter;
    return industryMatch && typeMatch;
  });

  const educationTypes: EducationProgram['type'][] = ['acting', 'filmmaking', 'producing', 'dance', 'voice'];

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <img
              src="/lovable-uploads/c3205623-a05c-42d3-98bc-f6f58256bf08.png"
              alt="Inlight"
              className="w-10 h-10 rounded-full object-cover"
            />
            <h1 className="text-2xl font-display font-bold">Resources</h1>
          </div>
        </div>
      </header>
      
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Industry Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'theatre' | 'film'); setSelectedCategory(null); }} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="theatre" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
              <Theater className="w-4 h-4" />
              Theatre
            </TabsTrigger>
            <TabsTrigger value="film" className="flex items-center gap-2 data-[state=active]:bg-primary/20">
              <Film className="w-4 h-4" />
              Film
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEducation.map((program) => (
                    <a 
                      key={program.name}
                      href={program.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                              {program.name}
                            </h3>
                            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {program.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {getEducationTypeIcon(program.type)}
                              {getEducationTypeName(program.type)}
                            </Badge>
                            {program.industry !== 'both' && (
                              <Badge variant="outline" className="text-xs">
                                {program.industry === 'theatre' ? 'Theatre' : 'Film'}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResources.map((resource) => (
                    <a 
                      key={resource.name}
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block group"
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
                          <Badge variant="secondary" className="text-xs">
                            {resourceCategories.find(c => c.id === resource.category)?.name}
                          </Badge>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEducation.map((program) => (
                    <a 
                      key={program.name}
                      href={program.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <Card className="h-full hover:bg-accent/50 transition-colors hover:shadow-lg">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                              {program.name}
                            </h3>
                            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {program.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {getEducationTypeIcon(program.type)}
                              {getEducationTypeName(program.type)}
                            </Badge>
                            {program.industry !== 'both' && (
                              <Badge variant="outline" className="text-xs">
                                {program.industry === 'theatre' ? 'Theatre' : 'Film'}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResources.map((resource) => (
                    <a 
                      key={resource.name}
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block group"
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
                          <Badge variant="secondary" className="text-xs">
                            {resourceCategories.find(c => c.id === resource.category)?.name}
                          </Badge>
                        </CardContent>
                      </Card>
                    </a>
                  ))}
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
