import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Theater, Search, Shuffle, Heart, Filter, SlidersHorizontal,
  Sparkles, ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSavedShows } from '@/hooks/useSavedShows';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShowCard, Show } from '@/components/stage-whisper/ShowCard';
import { ShowFilters, FilterState } from '@/components/stage-whisper/ShowFilters';
import { ShowDetailSheet } from '@/components/stage-whisper/ShowDetailSheet';
import { MyShowList } from '@/components/stage-whisper/MyShowList';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EMPTY_FILTERS: FilterState = {
  category: [],
  showType: [],
  priceTier: [],
  borough: [],
  accessibility: [],
};

const StageWhisperPage: React.FC = () => {
  const { user } = useAuth();
  const { isSaved, saveShow, unsaveShow, savedShowIds } = useSavedShows();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [activeTab, setActiveTab] = useState('broadway');
  const [viewTab, setViewTab] = useState<'discover' | 'my-list'>('discover');

  // Fetch all shows
  const { data: shows = [], isLoading } = useQuery({
    queryKey: ['nyc-shows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nyc_shows')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Show[];
    },
  });

  // Filter shows based on active category tab
  const filteredShows = useMemo(() => {
    let result = shows;

    // Filter by category tab
    result = result.filter(show => show.category === activeTab);

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(show => 
        show.title.toLowerCase().includes(query) ||
        show.venue.toLowerCase().includes(query) ||
        show.description?.toLowerCase().includes(query)
      );
    }

    // Show type filter
    if (filters.showType.length > 0) {
      result = result.filter(show => filters.showType.includes(show.show_type));
    }

    // Price tier filter
    if (filters.priceTier.length > 0) {
      result = result.filter(show => filters.priceTier.includes(show.price_tier));
    }

    // Borough filter
    if (filters.borough.length > 0) {
      result = result.filter(show => filters.borough.includes(show.borough));
    }

    // Accessibility filter
    if (filters.accessibility.length > 0) {
      result = result.filter(show => 
        show.accessibility_features?.some(f => filters.accessibility.includes(f))
      );
    }

    return result;
  }, [shows, searchQuery, filters, activeTab]);

  // Count shows by category for tab badges
  const showCounts = useMemo(() => ({
    broadway: shows.filter(s => s.category === 'broadway').length,
    'off-broadway': shows.filter(s => s.category === 'off-broadway').length,
    'off-off-broadway': shows.filter(s => s.category === 'off-off-broadway').length,
  }), [shows]);

  // Surprise Me - random show
  const handleSurpriseMe = () => {
    if (filteredShows.length === 0) {
      toast.error('No shows match your filters');
      return;
    }
    const randomIndex = Math.floor(Math.random() * filteredShows.length);
    const randomShow = filteredShows[randomIndex];
    setSelectedShow(randomShow);
    toast.success(`🎲 How about "${randomShow.title}"?`);
  };

  const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0);
  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <PageLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, hsl(350 90% 60%), hsl(30 90% 55%))',
                  boxShadow: '0 0 20px hsl(350 90% 60% / 0.4)'
                }}
              >
                <Theater className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Industry Now</h1>
                <p className="text-xs text-muted-foreground">Your NYC theatre companion 🎭</p>
              </div>
            </div>

            {/* Surprise Me Button */}
            <Button 
              variant="outline" 
              onClick={handleSurpriseMe}
              className="gap-2 border-primary/50 hover:bg-primary/10"
            >
              <Shuffle className="w-4 h-4" />
              <span className="hidden sm:inline">Surprise Me!</span>
            </Button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search shows, venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Sheet Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Shows</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <ShowFilters 
                    filters={filters}
                    onFilterChange={setFilters}
                    onClearAll={() => setFilters(EMPTY_FILTERS)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* View Toggle */}
        <div className="px-4 sm:px-6 lg:px-8 pb-2 flex gap-2">
          <Button 
            variant={viewTab === 'discover' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewTab('discover')}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Discover
          </Button>
          <Button 
            variant={viewTab === 'my-list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewTab('my-list')}
            className="gap-2"
          >
            <Heart className="w-4 h-4" />
            My List
            {savedShowIds.length > 0 && (
              <span className="ml-1 text-xs opacity-70">({savedShowIds.length})</span>
            )}
          </Button>
        </div>

        {/* Category Tabs */}
        {viewTab === 'discover' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6 lg:px-8">
            <TabsList className="w-full max-w-lg">
              <TabsTrigger value="broadway" className="flex-1">
                ⭐ Broadway
                <span className="ml-1 text-xs opacity-70">({showCounts.broadway})</span>
              </TabsTrigger>
              <TabsTrigger value="off-broadway" className="flex-1">
                🌟 Off-Broadway
                <span className="ml-1 text-xs opacity-70">({showCounts['off-broadway']})</span>
              </TabsTrigger>
              <TabsTrigger value="off-off-broadway" className="flex-1">
                ✨ Off-Off
                <span className="ml-1 text-xs opacity-70">({showCounts['off-off-broadway']})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </header>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Creator Note */}
        <div className="mb-4 p-3 bg-accent/50 rounded-lg border border-accent flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Putting up a show or releasing a project?</span>{' '}
            It will appear here to the public!
          </p>
        </div>

        {viewTab === 'discover' ? (
          <>
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
            {hasActiveFilters && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filters:</span>
                {filters.showType.map(t => (
                  <Button 
                    key={t} 
                    variant="secondary" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setFilters({...filters, showType: filters.showType.filter(x => x !== t)})}
                  >
                    {t} ×
                  </Button>
                ))}
                {filters.priceTier.map(p => (
                  <Button 
                    key={p} 
                    variant="secondary" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setFilters({...filters, priceTier: filters.priceTier.filter(x => x !== p)})}
                  >
                    {p} ×
                  </Button>
                ))}
                {filters.borough.map(b => (
                  <Button 
                    key={b} 
                    variant="secondary" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setFilters({...filters, borough: filters.borough.filter(x => x !== b)})}
                  >
                    {b} ×
                  </Button>
                ))}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Shows Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredShows.length === 0 ? (
              <div className="text-center py-12">
                <Theater className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || hasActiveFilters 
                    ? 'No shows match your search. Try adjusting your filters!'
                    : 'No shows available right now.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredShows.map((show) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    isSaved={isSaved(show.id)}
                    onSave={saveShow}
                    onUnsave={unsaveShow}
                    onClick={setSelectedShow}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <MyShowList 
            onShowClick={setSelectedShow}
            onUnsave={unsaveShow}
          />
        )}
      </div>

      {/* Show Detail Sheet */}
      <ShowDetailSheet
        show={selectedShow}
        isOpen={!!selectedShow}
        onClose={() => setSelectedShow(null)}
        isSaved={selectedShow ? isSaved(selectedShow.id) : false}
        onSave={saveShow}
        onUnsave={unsaveShow}
      />
    </PageLayout>
  );
};

export default StageWhisperPage;
