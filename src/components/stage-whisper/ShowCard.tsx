import React from 'react';
import { Heart, MapPin, Calendar, Clock, Ticket, Accessibility, Trash2 } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export interface Show {
  id: string;
  title: string;
  venue: string;
  borough: string;
  description: string | null;
  poster_url: string | null;
  show_type: string;
  category: string;
  price_tier: string;
  run_start: string | null;
  run_end: string | null;
  accessibility_features: string[] | null;
  rush_policy: string | null;
  lottery_info: string | null;
  official_url: string | null;
  is_active: boolean;
  show_times: string | null;
  submitted_by: string | null;
  badges?: string[] | null;
}

interface ShowCardProps {
  show: Show;
  isSaved: boolean;
  onSave: (showId: string) => void;
  onUnsave: (showId: string) => void;
  onClick: (show: Show) => void;
}

export const ShowCard: React.FC<ShowCardProps> = ({
  show,
  isSaved,
  onSave,
  onUnsave,
  onClick,
}) => {
  const daysUntilClosing = show.run_end 
    ? differenceInDays(new Date(show.run_end), new Date()) 
    : null;
  
  const isClosingSoon = daysUntilClosing !== null && daysUntilClosing > 0 && daysUntilClosing <= 21;
  const hasClosed = show.run_end && isPast(new Date(show.run_end));

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'broadway': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'off-broadway': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'off-off-broadway': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriceLabel = (tier: string) => {
    switch (tier) {
      case 'budget': return '$';
      case 'moderate': return '$$';
      case 'premium': return '$$$';
      default: return '$$';
    }
  };

  const getShowTypeEmoji = (type: string) => {
    switch (type) {
      case 'musical': return '🎵';
      case 'play': return '🎭';
      case 'opera': return '🎼';
      case 'dance': return '💃';
      default: return '🎪';
    }
  };

  const formatCategory = (category: string) => {
    return category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      onUnsave(show.id);
    } else {
      onSave(show.id);
    }
  };

  return (
    <div 
      className={cn(
        "group relative bg-card border border-border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1",
        hasClosed && "opacity-60"
      )}
      onClick={() => onClick(show)}
    >
      {/* Poster Image */}
      <div className="relative">
        <AspectRatio ratio={2/3} className="bg-muted">
          {show.poster_url ? (
            <img 
              src={show.poster_url} 
              alt={show.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
              <span className="text-6xl">{getShowTypeEmoji(show.show_type)}</span>
            </div>
          )}
        </AspectRatio>

        {/* Heart Button */}
        <button
          onClick={handleHeartClick}
          className={cn(
            "absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all duration-200",
            isSaved 
              ? "bg-primary text-primary-foreground shadow-lg" 
              : "bg-black/50 text-white hover:bg-primary hover:text-primary-foreground"
          )}
        >
          <Heart className={cn("w-5 h-5", isSaved && "fill-current")} />
        </button>

        {/* Closing Soon Badge */}
        {isClosingSoon && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-red-500/90 text-white border-0 backdrop-blur-sm animate-pulse">
              <Clock className="w-3 h-3 mr-1" />
              {daysUntilClosing} days left!
            </Badge>
          </div>
        )}

        {/* Custom Badges from Admin */}
        {!isClosingSoon && show.badges && show.badges.length > 0 && (
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {show.badges.slice(0, 2).map((badge) => (
              <Badge key={badge} className="bg-primary/90 text-primary-foreground border-0 backdrop-blur-sm text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          <Badge className={cn("border backdrop-blur-sm", getCategoryColor(show.category))}>
            {formatCategory(show.category)}
          </Badge>
          <Badge variant="secondary" className="backdrop-blur-sm">
            {getPriceLabel(show.price_tier)}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title & Type */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors">
              {show.title}
            </h3>
            <span className="text-xl flex-shrink-0" title={show.show_type}>
              {getShowTypeEmoji(show.show_type)}
            </span>
          </div>
          
          {/* Venue */}
          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{show.venue}</span>
          </div>
        </div>

        {/* Description */}
        {show.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {show.description}
          </p>
        )}

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {show.run_start && format(new Date(show.run_start), 'MMM d, yyyy')}
            {show.run_end ? ` – ${format(new Date(show.run_end), 'MMM d, yyyy')}` : ' – Open Run'}
          </span>
        </div>

        {/* Rush/Lottery Info */}
        {show.rush_policy && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Ticket className="w-3.5 h-3.5" />
            <span className="truncate">{show.rush_policy}</span>
          </div>
        )}

        {/* Accessibility */}
        {show.accessibility_features && show.accessibility_features.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Accessibility className="w-3.5 h-3.5" />
            <span>{show.accessibility_features.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowCard;
