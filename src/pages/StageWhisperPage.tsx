import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Theater, Search, Shuffle, Heart, SlidersHorizontal, Sparkles, Plus, Film, Tv, Music, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSavedShows } from '@/hooks/useSavedShows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShowCard, Show } from '@/components/stage-whisper/ShowCard';
import { ShowFilters, FilterState } from '@/components/stage-whisper/ShowFilters';
import { ShowDetailSheet } from '@/components/stage-whisper/ShowDetailSheet';
import { MyShowList } from '@/components/stage-whisper/MyShowList';
import { AddShowDialog } from '@/components/stage-whisper/AddShowDialog';
import { AddFilmDialog } from '@/components/stage-whisper/AddFilmDialog';
import { AddMusicShowDialog } from '@/components/stage-whisper/AddMusicShowDialog';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
const EMPTY_FILTERS: FilterState = {
  category: [],
  showType: [],
  priceTier: [],
  borough: [],
  accessibility: []
};
interface FilmMetric {
  id: string;
  title: string;
  studio: string;
  weekend_gross: number;
  total_gross: number;
  week_change: number;
  rating: number;
  weeks_in_release: number;
  poster_url?: string;
  date: string;
}
interface StreamingContent {
  id: string;
  title: string;
  content_type: 'movie' | 'tv';
  platform: string;
  description?: string;
  poster_url?: string;
  genre?: string;
  release_year?: number;
  rating: number;
}
interface UserFilm {
  id: string;
  title: string;
  description?: string;
  link_url: string;
  poster_url?: string;
  submitted_by: string;
  is_anonymous?: boolean;
  created_at: string;
}
interface UserMusicShow {
  id: string;
  title: string;
  description?: string;
  venue?: string;
  show_date?: string;
  ticket_url?: string;
  is_free?: boolean;
  poster_url?: string;
  submitted_by: string;
  is_anonymous?: boolean;
  created_at: string;
}
const StageWhisperPage: React.FC = () => {
  const {
    user
  } = useAuth();
  const {
    isSaved,
    saveShow,
    unsaveShow,
    savedShowIds
  } = useSavedShows();
  const [industryTab, setIndustryTab] = useState<'theatre' | 'film' | 'music'>('theatre');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [activeTab, setActiveTab] = useState('broadway');
  const [viewTab, setViewTab] = useState<'discover' | 'my-list'>('discover');
  const [filmViewTab, setFilmViewTab] = useState<'theatres' | 'streaming' | 'student'>('theatres');
  const [musicTab, setMusicTab] = useState<'local-shows'>('local-shows');

  // Fetch all shows
  const {
    data: shows = [],
    isLoading: loadingShows
  } = useQuery({
    queryKey: ['nyc-shows'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('nyc_shows').select('*').eq('is_active', true).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data as Show[];
    }
  });

  // Fetch films in theatres
  const {
    data: theatreFilms = [],
    isLoading: loadingTheatres
  } = useQuery({
    queryKey: ['film-metrics'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('film_metrics').select('*').order('weekend_gross', {
        ascending: false
      }).limit(20);
      if (error) throw error;
      return data as FilmMetric[];
    },
    enabled: industryTab === 'film'
  });

  // Fetch streaming content
  const {
    data: streamingContent = [],
    isLoading: loadingStreaming
  } = useQuery({
    queryKey: ['streaming-content'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('streaming_content').select('*').eq('is_active', true).order('rating', {
        ascending: false
      });
      if (error) throw error;
      return data as StreamingContent[];
    },
    enabled: industryTab === 'film'
  });

  // Fetch user-submitted films
  const {
    data: userFilms = [],
    isLoading: loadingUserFilms
  } = useQuery({
    queryKey: ['user-films'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_films')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserFilm[];
    },
    enabled: industryTab === 'film'
  });

  // Fetch user-submitted music shows
  const {
    data: userMusicShows = [],
    isLoading: loadingMusicShows
  } = useQuery({
    queryKey: ['user-music-shows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_music_shows')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserMusicShow[];
    },
    enabled: industryTab === 'music'
  });

  // Filter shows based on active category tab
  const filteredShows = useMemo(() => {
    let result = shows;
    result = result.filter(show => show.category === activeTab);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(show => show.title.toLowerCase().includes(query) || show.venue.toLowerCase().includes(query) || show.description?.toLowerCase().includes(query));
    }
    if (filters.showType.length > 0) {
      result = result.filter(show => filters.showType.includes(show.show_type));
    }
    if (filters.priceTier.length > 0) {
      result = result.filter(show => filters.priceTier.includes(show.price_tier));
    }
    if (filters.borough.length > 0) {
      result = result.filter(show => filters.borough.includes(show.borough));
    }
    if (filters.accessibility.length > 0) {
      result = result.filter(show => show.accessibility_features?.some(f => filters.accessibility.includes(f)));
    }
    return result;
  }, [shows, searchQuery, filters, activeTab]);

  // Count shows by category
  const showCounts = useMemo(() => ({
    broadway: shows.filter(s => s.category === 'broadway').length,
    'off-broadway': shows.filter(s => s.category === 'off-broadway').length,
    'off-off-broadway': shows.filter(s => s.category === 'off-off-broadway').length,
    'school': shows.filter(s => s.category === 'school').length
  }), [shows]);

  // Surprise Me
  const handleSurpriseMe = () => {
    if (industryTab === 'theatre') {
      if (filteredShows.length === 0) {
        toast.error('No shows match your filters');
        return;
      }
      const randomIndex = Math.floor(Math.random() * filteredShows.length);
      const randomShow = filteredShows[randomIndex];
      setSelectedShow(randomShow);
      toast.success(`🎲 How about "${randomShow.title}"?`);
    } else {
      const items = filmViewTab === 'theatres' ? theatreFilms : streamingContent;
      if (items.length === 0) {
        toast.error('No content available');
        return;
      }
      const randomItem = items[Math.floor(Math.random() * items.length)];
      toast.success(`🎲 How about "${randomItem.title}"?`);
    }
  };
  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0);
  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };
  return <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img
                src="/lovable-uploads/c3205623-a05c-42d3-98bc-f6f58256bf08.png"
                alt="Inlight"
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <h1 className="text-2xl font-display font-bold">Industry Now</h1>
                <p className="text-xs text-muted-foreground">
                  {industryTab === 'theatre' ? 'Your NYC theatre companion 🎭' : industryTab === 'film' ? 'Films & streaming highlights 🎬' : 'Music & local performances 🎵'}
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={handleSurpriseMe} className="gap-2 border-primary/50 hover:bg-primary/10">
              <Shuffle className="w-4 h-4" />
              <span className="hidden sm:inline">Surprise Me!</span>
            </Button>
          </div>

          {/* Industry Tabs */}
          <Tabs value={industryTab} onValueChange={v => setIndustryTab(v as 'theatre' | 'film' | 'music')} className="mb-4">
            <TabsList className="grid w-full max-w-md grid-cols-3">
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
          </Tabs>

          {/* Search Bar - Theatre only */}
          {industryTab === 'theatre' && <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search shows, venues..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {activeFilterCount}
                      </span>}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filter Shows</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <ShowFilters filters={filters} onFilterChange={setFilters} onClearAll={() => setFilters(EMPTY_FILTERS)} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>}
        </div>

        {/* Theatre View Toggle */}
        {industryTab === 'theatre' && <div className="px-4 sm:px-6 lg:px-8 pb-2 flex gap-2">
            <Button variant={viewTab === 'discover' ? 'default' : 'ghost'} size="sm" onClick={() => setViewTab('discover')} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Discover
            </Button>
            <Button variant={viewTab === 'my-list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewTab('my-list')} className="gap-2">
              <Heart className="w-4 h-4" />
              My List
              {savedShowIds.length > 0 && <span className="ml-1 text-xs opacity-70">({savedShowIds.length})</span>}
            </Button>
          </div>}

        {/* Theatre Category Tabs */}
        {industryTab === 'theatre' && viewTab === 'discover' && <div className="overflow-x-auto scrollbar-thin px-4 sm:px-6 lg:px-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
                <TabsTrigger value="broadway" className="flex-shrink-0 whitespace-nowrap">
                  ⭐ Broadway
                  <span className="ml-1 text-xs opacity-70">({showCounts.broadway})</span>
                </TabsTrigger>
                <TabsTrigger value="off-broadway" className="flex-shrink-0 whitespace-nowrap">
                  🌟 Off-Broadway
                  <span className="ml-1 text-xs opacity-70">({showCounts['off-broadway']})</span>
                </TabsTrigger>
                <TabsTrigger value="off-off-broadway" className="flex-shrink-0 whitespace-nowrap">
                  ✨ Off-Off
                  <span className="ml-1 text-xs opacity-70">({showCounts['off-off-broadway']})</span>
                </TabsTrigger>
                <TabsTrigger value="school" className="flex-shrink-0 whitespace-nowrap">
                  🎓 School
                  <span className="ml-1 text-xs opacity-70">({showCounts['school']})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>}

        {/* Film View Toggle */}
        {industryTab === 'film' && <div className="px-4 sm:px-6 lg:px-8 pb-2 flex gap-2">
            <Button variant={filmViewTab === 'theatres' ? 'default' : 'ghost'} size="sm" onClick={() => setFilmViewTab('theatres')} className="gap-2">
              <Film className="w-4 h-4" />
              In Theatres
            </Button>
            <Button variant={filmViewTab === 'streaming' ? 'default' : 'ghost'} size="sm" onClick={() => setFilmViewTab('streaming')} className="gap-2">
              <Tv className="w-4 h-4" />
              Streaming
            </Button>
            <Button variant={filmViewTab === 'student' ? 'default' : 'ghost'} size="sm" onClick={() => setFilmViewTab('student')} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Community
            </Button>
          </div>}
      </header>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* THEATRE CONTENT */}
        {industryTab === 'theatre' && <>
            {/* Creator Note - Only show on off-off-broadway and school tabs */}
            {(activeTab === 'off-off-broadway' || activeTab === 'school') && viewTab === 'discover' && <div className="mb-4 p-3 bg-accent/50 rounded-lg border border-accent flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {activeTab === 'school' ? <>
                        <span className="font-medium text-foreground">Putting up a show at school?</span>{' '}
                        It will appear here to the public!
                      </> : <>
                        <span className="font-medium text-foreground">Putting up a show?</span>{' '}
                        It will appear here to the public!
                      </>}
                  </p>
                </div>
                <AddShowDialog category={activeTab as 'off-off-broadway' | 'school'} trigger={<Button size="sm" className="gap-1.5 shrink-0">
                      <Plus className="w-4 h-4" />
                      Add Your Show
                    </Button>} />
              </div>}

            {viewTab === 'discover' ? <>
                {/* Welcome Message */}
                <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
                  <p className="text-sm">
                    <span className="font-medium">Hey theatre lover! 👋</span>{' '}
                    <span className="text-muted-foreground">
                      {filteredShows.length} shows currently playing in NYC. 
                      Tap a show for details, community tips, and tickets.
                    </span>
                  </p>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Filters:</span>
                    {filters.showType.map(t => <Button key={t} variant="secondary" size="sm" className="h-6 text-xs" onClick={() => setFilters({
              ...filters,
              showType: filters.showType.filter(x => x !== t)
            })}>
                        {t} ×
                      </Button>)}
                    {filters.priceTier.map(p => <Button key={p} variant="secondary" size="sm" className="h-6 text-xs" onClick={() => setFilters({
              ...filters,
              priceTier: filters.priceTier.filter(x => x !== p)
            })}>
                        {p} ×
                      </Button>)}
                    {filters.borough.map(b => <Button key={b} variant="secondary" size="sm" className="h-6 text-xs" onClick={() => setFilters({
              ...filters,
              borough: filters.borough.filter(x => x !== b)
            })}>
                        {b} ×
                      </Button>)}
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
                      Clear all
                    </Button>
                  </div>}

                {/* Shows Grid */}
                {loadingShows ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div> : filteredShows.length === 0 ? <div className="text-center py-12">
                    <Theater className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery || hasActiveFilters ? 'No shows match your search. Try adjusting your filters!' : 'No shows available right now.'}
                    </p>
                  </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredShows.map(show => <ShowCard key={show.id} show={show} isSaved={isSaved(show.id)} onSave={saveShow} onUnsave={unsaveShow} onClick={setSelectedShow} />)}
                  </div>}
              </> : <MyShowList onShowClick={setSelectedShow} onUnsave={unsaveShow} />}
          </>}

        {/* FILM CONTENT */}
        {industryTab === 'film' && <>
            {/* Welcome Message */}
            <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
              <p className="text-sm">
                <span className="font-medium">What's playing? 🍿</span>{' '}
                <span className="text-muted-foreground">
                  {filmViewTab === 'theatres' ? `${theatreFilms.length} films currently in theatres.` : `${streamingContent.length} top streaming titles to watch.`}
                </span>
              </p>
            </div>

            {/* Films In Theatres */}
            {filmViewTab === 'theatres' && <>
                {loadingTheatres ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div> : theatreFilms.length === 0 ? <div className="text-center py-12">
                    <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No films data available right now.</p>
                  </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {theatreFilms.map(film => <Card key={film.id} className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                        <div className="aspect-[2/3] relative bg-muted">
                          {film.poster_url ? <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-12 h-12 text-muted-foreground" />
                            </div>}
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-background/90 text-foreground">
                              ⭐ {film.rating.toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {film.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">{film.studio}</p>
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className="text-primary font-medium">{formatCurrency(film.weekend_gross)}</span>
                            <span className="text-muted-foreground">Week {film.weeks_in_release}</span>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </>}

            {/* Streaming Content */}
            {filmViewTab === 'streaming' && <>
                {loadingStreaming ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div> : streamingContent.length === 0 ? <div className="text-center py-12">
                    <Tv className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No streaming content available right now.</p>
                  </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {streamingContent.map(content => <Card key={content.id} className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                        <div className="aspect-[2/3] relative bg-muted">
                          {content.poster_url ? <img src={content.poster_url} alt={content.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                              {content.content_type === 'tv' ? <Tv className="w-12 h-12 text-muted-foreground" /> : <Film className="w-12 h-12 text-muted-foreground" />}
                            </div>}
                          <div className="absolute top-2 left-2">
                            <Badge variant={content.content_type === 'tv' ? 'secondary' : 'outline'} className="text-xs">
                              {content.content_type === 'tv' ? 'TV' : 'Movie'}
                            </Badge>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-background/90 text-foreground">
                              ⭐ {Number(content.rating).toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {content.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">{content.platform}</p>
                          {content.genre && <Badge variant="outline" className="mt-2 text-xs">{content.genre}</Badge>}
                        </CardContent>
                      </Card>)}
                  </div>}
              </>}

            {/* Community / Student Films */}
            {filmViewTab === 'student' && <>
                {/* Creator Note */}
                <div className="mb-4 p-3 bg-accent/50 rounded-lg border border-accent flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Released a student film or want to advertise a film you worked on?</span>{' '}
                      Share it with the community!
                    </p>
                  </div>
                  <AddFilmDialog trigger={
                    <Button size="sm" className="gap-1.5 shrink-0">
                      <Plus className="w-4 h-4" />
                      Add Film
                    </Button>
                  } />
                </div>

                {loadingUserFilms ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div> : userFilms.length === 0 ? <div className="text-center py-12">
                    <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No community films yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">Be the first to share your work!</p>
                  </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {userFilms.map(film => <a key={film.id} href={film.link_url} target="_blank" rel="noopener noreferrer">
                        <Card className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                          <div className="aspect-[2/3] relative bg-muted">
                            {film.poster_url ? <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-12 h-12 text-muted-foreground" />
                              </div>}
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-background/90 text-foreground text-xs">
                                <ExternalLink className="w-3 h-3" />
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-3">
                            <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                              {film.title}
                            </h3>
                            {film.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{film.description}</p>}
                          </CardContent>
                        </Card>
                      </a>)}
                  </div>}
              </>}
          </>}

        {/* MUSIC CONTENT */}
        {industryTab === 'music' && <>
            {/* Music Category Tabs */}
            <div className="flex gap-2 mb-6">
              <Button variant={musicTab === 'local-shows' ? 'default' : 'ghost'} size="sm" onClick={() => setMusicTab('local-shows')} className="gap-2">
                <Music className="w-4 h-4" />
                Local Shows
              </Button>
            </div>

            {/* Local Shows Section */}
            {musicTab === 'local-shows' && <div className="space-y-6">
                <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
                  <h2 className="text-xl font-display font-semibold mb-2">🎵 Local Shows by Students & Alumni</h2>
                  <p className="text-sm text-muted-foreground">Discover music performances and concerts by the community.</p>
                </div>

                {/* Creator Note */}
                <div className="p-3 bg-accent/50 rounded-lg border border-accent flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Performing in an upcoming show?</span>{' '}
                      Let your community know!
                    </p>
                  </div>
                  <AddMusicShowDialog trigger={
                    <Button size="sm" className="gap-1.5 shrink-0">
                      <Plus className="w-4 h-4" />
                      Add Show
                    </Button>
                  } />
                </div>

                {loadingMusicShows ? <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div> : userMusicShows.length === 0 ? <div className="text-center py-12">
                    <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No local shows listed yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">Be the first to share your performance!</p>
                  </div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {userMusicShows.map(show => <Card key={show.id} className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer" onClick={() => {
                        if (show.ticket_url) window.open(show.ticket_url, '_blank');
                      }}>
                        <div className="aspect-[2/3] relative bg-muted">
                          {show.poster_url ? <img src={show.poster_url} alt={show.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-12 h-12 text-muted-foreground" />
                            </div>}
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-background/90 text-foreground text-xs">
                              {show.is_free ? 'Free' : 'Tickets'}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {show.title}
                          </h3>
                          {show.venue && <p className="text-xs text-muted-foreground line-clamp-1">{show.venue}</p>}
                          {show.show_date && <p className="text-xs text-muted-foreground mt-1">{new Date(show.show_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                        </CardContent>
                      </Card>)}
                  </div>}
              </div>}
          </>}
      </div>

      {/* Show Detail Sheet */}
      <ShowDetailSheet show={selectedShow} isOpen={!!selectedShow} onClose={() => setSelectedShow(null)} isSaved={selectedShow ? isSaved(selectedShow.id) : false} onSave={saveShow} onUnsave={unsaveShow} />
    </div>;
};
export default StageWhisperPage;