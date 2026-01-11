import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Theater, TrendingUp, TrendingDown, Star, DollarSign, Users, Clock } from 'lucide-react';

interface FilmData {
  id: string;
  title: string;
  studio: string;
  weekend_gross: number;
  total_gross: number;
  week_change: number;
  rating: number;
  weeks_in_release: number;
}

interface BroadwayShow {
  id: string;
  title: string;
  theater: string;
  show_type: 'musical' | 'play';
  weekly_gross: number;
  attendance: number;
  capacity_percentage: number;
}

interface IndustryHighlight {
  id: string;
  content: string;
  category: string;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString()}`;
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'film': return 'hsl(22,100%,59%)';
    case 'broadway': return 'hsl(330,100%,64%)';
    default: return 'hsl(186,100%,50%)';
  }
};

const IndustryMetrics: React.FC = () => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Fetch film metrics
  const { data: films, isLoading: filmsLoading } = useQuery({
    queryKey: ['film-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('film_metrics')
        .select('*')
        .order('weekend_gross', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as FilmData[];
    }
  });

  // Fetch broadway metrics
  const { data: shows, isLoading: showsLoading } = useQuery({
    queryKey: ['broadway-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadway_metrics')
        .select('*')
        .order('weekly_gross', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as BroadwayShow[];
    }
  });

  // Fetch industry highlights
  const { data: highlights, isLoading: highlightsLoading } = useQuery({
    queryKey: ['industry-highlights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industry_highlights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as IndustryHighlight[];
    }
  });

  // Calculate aggregate stats
  const totalBoxOffice = films?.reduce((sum, f) => sum + Number(f.weekend_gross), 0) || 0;
  const totalBroadwayAttendance = shows?.reduce((sum, s) => sum + s.attendance, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Industry Metrics</h2>
          <p className="text-muted-foreground">Daily updates from theatre and film</p>
        </div>
        <div className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm">
          📅 {today}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[hsl(22,100%,59%)] to-[hsl(10,100%,65%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm opacity-90">Weekend Box Office</span>
            </div>
            {filmsLoading ? (
              <Skeleton className="h-8 w-24 bg-white/20" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(totalBoxOffice)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm opacity-90">Broadway Attendance</span>
            </div>
            {showsLoading ? (
              <Skeleton className="h-8 w-24 bg-white/20" />
            ) : (
              <p className="text-2xl font-bold">{totalBroadwayAttendance.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[hsl(186,100%,50%)] to-[hsl(200,100%,60%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-5 h-5" />
              <span className="text-sm opacity-90">Films Tracked</span>
            </div>
            <p className="text-2xl font-bold">{films?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[hsl(264,100%,71%)] to-[hsl(280,100%,65%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Theater className="w-5 h-5" />
              <span className="text-sm opacity-90">Active Shows</span>
            </div>
            <p className="text-2xl font-bold">{shows?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Films */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-[hsl(22,100%,59%)]" />
            Top Box Office This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filmsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {films?.map((film, index) => (
                <div 
                  key={film.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[hsl(22,100%,59%)] text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{film.title}</h3>
                      <Badge variant="outline" className="shrink-0">{film.studio}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-[hsl(48,100%,50%)] text-[hsl(48,100%,50%)]" />
                        {film.rating}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Week {film.weeks_in_release}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(film.weekend_gross))}</p>
                    <div className={`flex items-center justify-end gap-1 text-sm ${
                      film.week_change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {film.week_change >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(film.week_change)}%
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground hidden md:block">
                    <p className="text-foreground font-medium">{formatCurrency(Number(film.total_gross))}</p>
                    <p>Total Gross</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broadway Shows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Theater className="w-5 h-5 text-[hsl(330,100%,64%)]" />
            Top Broadway Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {shows?.map((show, index) => (
                <div 
                  key={show.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[hsl(330,100%,64%)] text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{show.title}</h3>
                      <Badge 
                        variant="outline" 
                        className={`shrink-0 ${
                          show.show_type === 'musical' 
                            ? 'border-[hsl(264,100%,71%)] text-[hsl(264,100%,71%)]' 
                            : 'border-[hsl(186,100%,50%)] text-[hsl(186,100%,50%)]'
                        }`}
                      >
                        {show.show_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{show.theater} Theatre</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(show.weekly_gross))}</p>
                    <p className="text-sm text-muted-foreground">Weekly Gross</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-secondary overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)]"
                          style={{ width: `${Math.min(show.capacity_percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{show.capacity_percentage}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{show.attendance.toLocaleString()} seats</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Industry News Snippet */}
      <Card className="bg-gradient-to-br from-secondary/50 to-secondary/20">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">📰 Industry Highlights</h3>
          {highlightsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {highlights?.map((highlight) => (
                <p key={highlight.id} className="flex items-start gap-2">
                  <span style={{ color: getCategoryColor(highlight.category) }}>•</span>
                  <span>{highlight.content}</span>
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IndustryMetrics;
