import React from 'react';
import { Film, Star, Clock, DollarSign, TrendingUp, TrendingDown, ExternalLink, Share2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

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
  ticket_url?: string;
  date: string;
}

interface FilmDetailSheetProps {
  film: FilmMetric | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved?: boolean;
  onSave?: (filmId: string) => void;
  onUnsave?: (filmId: string) => void;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
};

export const FilmDetailSheet: React.FC<FilmDetailSheetProps> = ({
  film,
  isOpen,
  onClose,
  isSaved = false,
  onSave,
  onUnsave,
}) => {
  if (!film) return null;

  const handleSaveToggle = () => {
    if (isSaved) {
      onUnsave?.(film.id);
    } else {
      onSave?.(film.id);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          {/* Header Image */}
          <div className="relative -mx-6 -mt-6">
            {film.poster_url ? (
              <img
                src={film.poster_url}
                alt={film.title}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                <Film className="w-20 h-20 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

            {/* Floating Actions */}
            <div className="absolute top-4 right-4 flex gap-2">
              {/* Save Button */}
              <Button
                size="icon"
                variant="secondary"
                className={cn(
                  "backdrop-blur-sm",
                  isSaved && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={handleSaveToggle}
              >
                <Heart className={cn("w-5 h-5", isSaved && "fill-current")} />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="backdrop-blur-sm"
                onClick={() => {
                  navigator.share?.({
                    title: film.title,
                    text: `Check out ${film.title} in theatres!`,
                    url: window.location.href,
                  });
                }}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <SheetTitle className="text-2xl font-display pr-8">
            {film.title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Quick Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Film className="w-4 h-4" />
              <span>{film.studio}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Week {film.weeks_in_release} in release</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {film.rating.toFixed(1)}
              </Badge>
              <Badge variant="outline" className={`gap-1 ${film.week_change >= 0 ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}`}>
                {film.week_change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(film.week_change)}% vs last week
              </Badge>
            </div>
          </div>

          {/* Box Office Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Weekend Gross
              </div>
              <p className="text-xl font-bold">{formatCurrency(Number(film.weekend_gross))}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Total Gross
              </div>
              <p className="text-xl font-bold">{formatCurrency(Number(film.total_gross))}</p>
            </div>
          </div>

          {/* Get Tickets */}
          <div className="flex gap-3">
            <Button className="flex-1" asChild>
              <a
                href={film.ticket_url || `https://www.fandango.com/search?q=${encodeURIComponent(film.title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Tickets
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FilmDetailSheet;
