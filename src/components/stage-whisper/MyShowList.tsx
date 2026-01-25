import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Calendar, Bell, BellOff, Trash2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Show } from './ShowCard';

interface SavedShow {
  id: string;
  show_id: string;
  saved_at: string;
  remind_closing: boolean;
  notes: string | null;
  show: Show;
}

interface MyShowListProps {
  onShowClick: (show: Show) => void;
  onUnsave: (showId: string) => void;
}

export const MyShowList: React.FC<MyShowListProps> = ({ onShowClick, onUnsave }) => {
  const { user } = useAuth();

  const { data: savedShows = [], isLoading } = useQuery({
    queryKey: ['my-saved-shows', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: saved, error } = await supabase
        .from('saved_shows')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });
      
      if (error) throw error;

      // Fetch show details
      const showIds = saved.map(s => s.show_id);
      const { data: shows } = await supabase
        .from('nyc_shows')
        .select('*')
        .in('id', showIds);

      const showMap = new Map(shows?.map(s => [s.id, s]) || []);

      return saved.map(s => ({
        ...s,
        show: showMap.get(s.show_id),
      })).filter(s => s.show) as SavedShow[];
    },
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <div className="text-center py-12">
        <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Sign in to save shows to your list</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (savedShows.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">Your show list is empty</p>
        <p className="text-muted-foreground text-sm">
          Tap the heart on any show to save it here ❤️
        </p>
      </div>
    );
  }

  // Group by closing soon / running / closed
  const closingSoon = savedShows.filter(s => {
    const days = s.show.run_end ? differenceInDays(new Date(s.show.run_end), new Date()) : null;
    return days !== null && days > 0 && days <= 21;
  });

  const stillRunning = savedShows.filter(s => {
    if (!s.show.run_end) return true;
    const days = differenceInDays(new Date(s.show.run_end), new Date());
    return days > 21;
  });

  const getShowTypeEmoji = (type: string) => {
    switch (type) {
      case 'musical': return '🎵';
      case 'play': return '🎭';
      case 'opera': return '🎼';
      case 'dance': return '💃';
      default: return '🎪';
    }
  };

  const ShowListItem: React.FC<{ item: SavedShow }> = ({ item }) => {
    const daysLeft = item.show.run_end 
      ? differenceInDays(new Date(item.show.run_end), new Date()) 
      : null;

    return (
      <div 
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer group"
        onClick={() => onShowClick(item.show)}
      >
        {/* Poster Thumbnail */}
        <div className="w-16 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {item.show.poster_url ? (
            <img 
              src={item.show.poster_url} 
              alt={item.show.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
              <span className="text-2xl">{getShowTypeEmoji(item.show.show_type)}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate group-hover:text-primary transition-colors">
            {item.show.title}
          </h4>
          <p className="text-sm text-muted-foreground truncate">{item.show.venue}</p>
          
          <div className="flex items-center gap-2 mt-2">
            {daysLeft !== null && daysLeft > 0 && daysLeft <= 21 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                {daysLeft} days left
              </Badge>
            )}
            {!item.show.run_end && (
              <Badge variant="secondary" className="text-xs">Open Run</Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnsave(item.show.id);
          }}
          className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Closing Soon Section */}
      {closingSoon.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⏰</span>
            <h3 className="font-medium text-red-400">Closing Soon - Don't Miss Out!</h3>
          </div>
          <div className="space-y-3">
            {closingSoon.map(item => (
              <ShowListItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Still Running Section */}
      {stillRunning.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎭</span>
            <h3 className="font-medium">Your Show List</h3>
            <span className="text-sm text-muted-foreground">({stillRunning.length})</span>
          </div>
          <div className="space-y-3">
            {stillRunning.map(item => (
              <ShowListItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyShowList;
