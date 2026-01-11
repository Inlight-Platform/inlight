import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Theater, TrendingUp, TrendingDown, Star, DollarSign, Users, Clock } from 'lucide-react';

interface FilmData {
  id: string;
  title: string;
  studio: string;
  weekendGross: string;
  totalGross: string;
  change: number;
  rating: number;
  weeks: number;
}

interface BroadwayShow {
  id: string;
  title: string;
  theater: string;
  weeklyGross: string;
  attendance: string;
  capacity: number;
  type: 'musical' | 'play';
}

const topFilms: FilmData[] = [
  {
    id: 'film-1',
    title: 'The Midnight Hour',
    studio: 'A24',
    weekendGross: '$42.3M',
    totalGross: '$156.8M',
    change: 12,
    rating: 8.7,
    weeks: 3
  },
  {
    id: 'film-2',
    title: 'Echoes of Tomorrow',
    studio: 'Universal',
    weekendGross: '$38.1M',
    totalGross: '$98.2M',
    change: -8,
    rating: 7.9,
    weeks: 2
  },
  {
    id: 'film-3',
    title: 'The Last Symphony',
    studio: 'Focus Features',
    weekendGross: '$28.7M',
    totalGross: '$203.4M',
    change: -15,
    rating: 9.1,
    weeks: 5
  },
  {
    id: 'film-4',
    title: 'Neon Dreams',
    studio: 'Neon',
    weekendGross: '$21.4M',
    totalGross: '$45.6M',
    change: 34,
    rating: 8.3,
    weeks: 2
  },
  {
    id: 'film-5',
    title: 'Whispers in the Dark',
    studio: 'Blumhouse',
    weekendGross: '$18.9M',
    totalGross: '$67.2M',
    change: -22,
    rating: 7.4,
    weeks: 4
  }
];

const broadwayShows: BroadwayShow[] = [
  {
    id: 'show-1',
    title: 'Hamilton',
    theater: 'Richard Rodgers',
    weeklyGross: '$3.2M',
    attendance: '12,847',
    capacity: 102,
    type: 'musical'
  },
  {
    id: 'show-2',
    title: 'The Lion King',
    theater: 'Minskoff',
    weeklyGross: '$2.8M',
    attendance: '11,234',
    capacity: 98,
    type: 'musical'
  },
  {
    id: 'show-3',
    title: 'Wicked',
    theater: 'Gershwin',
    weeklyGross: '$2.6M',
    attendance: '12,102',
    capacity: 99,
    type: 'musical'
  },
  {
    id: 'show-4',
    title: 'Death of a Salesman',
    theater: 'Hudson',
    weeklyGross: '$1.4M',
    attendance: '6,234',
    capacity: 87,
    type: 'play'
  },
  {
    id: 'show-5',
    title: 'The Outsiders',
    theater: 'Jacobs',
    weeklyGross: '$1.8M',
    attendance: '8,456',
    capacity: 94,
    type: 'musical'
  }
];

const industryStats = {
  totalBoxOffice: '$892M',
  broadwayAttendance: '298,432',
  newReleases: 12,
  broadwayShows: 41
};

const IndustryMetrics: React.FC = () => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

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
            <p className="text-2xl font-bold">{industryStats.totalBoxOffice}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm opacity-90">Broadway Attendance</span>
            </div>
            <p className="text-2xl font-bold">{industryStats.broadwayAttendance}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[hsl(186,100%,50%)] to-[hsl(200,100%,60%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-5 h-5" />
              <span className="text-sm opacity-90">New Releases</span>
            </div>
            <p className="text-2xl font-bold">{industryStats.newReleases}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[hsl(264,100%,71%)] to-[hsl(280,100%,65%)] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Theater className="w-5 h-5" />
              <span className="text-sm opacity-90">Active Shows</span>
            </div>
            <p className="text-2xl font-bold">{industryStats.broadwayShows}</p>
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
          <div className="space-y-4">
            {topFilms.map((film, index) => (
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
                      Week {film.weeks}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{film.weekendGross}</p>
                  <div className={`flex items-center justify-end gap-1 text-sm ${
                    film.change >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {film.change >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(film.change)}%
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground hidden md:block">
                  <p className="text-foreground font-medium">{film.totalGross}</p>
                  <p>Total Gross</p>
                </div>
              </div>
            ))}
          </div>
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
          <div className="space-y-4">
            {broadwayShows.map((show, index) => (
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
                        show.type === 'musical' 
                          ? 'border-[hsl(264,100%,71%)] text-[hsl(264,100%,71%)]' 
                          : 'border-[hsl(186,100%,50%)] text-[hsl(186,100%,50%)]'
                      }`}
                    >
                      {show.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{show.theater} Theatre</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{show.weeklyGross}</p>
                  <p className="text-sm text-muted-foreground">Weekly Gross</p>
                </div>
                <div className="text-right hidden md:block">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 rounded-full bg-secondary overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-[hsl(330,100%,64%)] to-[hsl(350,100%,70%)]"
                        style={{ width: `${show.capacity}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{show.capacity}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{show.attendance} seats</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Industry News Snippet */}
      <Card className="bg-gradient-to-br from-secondary/50 to-secondary/20">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">📰 Industry Highlights</h3>
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2">
              <span className="text-[hsl(22,100%,59%)]">•</span>
              <span>A24 continues strong performance with indie darling "The Midnight Hour" topping weekend charts</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[hsl(330,100%,64%)]">•</span>
              <span>Broadway attendance up 8% compared to same period last year</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[hsl(186,100%,50%)]">•</span>
              <span>Hamilton celebrates 9th anniversary with special cast reunion performance</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[hsl(147,100%,50%)]">•</span>
              <span>Streaming releases continue to impact theatrical windows as studios experiment with hybrid models</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndustryMetrics;
