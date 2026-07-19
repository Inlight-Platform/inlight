import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isPast } from 'date-fns';
import { BookmarkX, Clock, MapPin, Theater } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface SavedShowsProps {
  userId: string;
  isOwnProfile?: boolean;
  watchlistPublic?: boolean;
}

interface WatchlistRow {
  id: string;
  saved_at: string;
  show_id: string;
  title: string;
  venue: string;
  borough: string;
  show_type: string;
  poster_url: string | null;
  run_start: string | null;
  run_end: string | null;
  official_url: string | null;
}

const closingLabel = (runEnd: string | null): { text: string; urgent: boolean } | null => {
  if (!runEnd) return null;
  const end = parseISO(runEnd);
  if (isPast(end)) return { text: 'Closed', urgent: false };
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days === 0) return { text: 'Closes today', urgent: true };
  if (days <= 7) return { text: `${days}d left`, urgent: true };
  if (days <= 30) return { text: `${days}d left`, urgent: false };
  return null;
};

interface ShowGridProps {
  saves: WatchlistRow[];
  faded?: boolean;
  isOwnProfile: boolean;
  onRemove: (showId: string) => void;
  removing: boolean;
}

const ShowGrid: React.FC<ShowGridProps> = ({ saves, faded, isOwnProfile, onRemove, removing }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
    {saves.map((save) => {
      const show = { ...save, id: save.show_id };
      const closing = closingLabel(save.run_end);
      return (
        <Card
          key={save.id}
          className={`relative overflow-hidden bg-card border-border group flex flex-col${faded ? ' opacity-60' : ''}`}
        >
          {isOwnProfile && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-1.5 top-1.5 z-10 h-6 w-6 bg-background/90 text-muted-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(save.show_id)}
              disabled={removing}
              title="Remove from watchlist"
            >
              <BookmarkX className="h-3 w-3" />
            </Button>
          )}

          <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
            {show.poster_url ? (
              <img
                src={show.poster_url}
                alt={show.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Theater className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>

          <div className="p-2 space-y-1 flex-1 flex flex-col justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium leading-tight line-clamp-2">{show.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                {show.venue}
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              {closing ? (
                <Badge
                  variant={closing.urgent ? 'destructive' : 'secondary'}
                  className="text-[9px] px-1 py-0 gap-0.5 h-4"
                >
                  <Clock className="h-2 w-2" />
                  {closing.text}
                </Badge>
              ) : show.run_end ? (
                <span className="text-[10px] text-muted-foreground">
                  Until {format(parseISO(show.run_end), 'MMM d')}
                </span>
              ) : (
                <span />
              )}
            </div>
          </div>
        </Card>
      );
    })}
  </div>
);

const emptyMessage = (history: boolean, isOwnProfile: boolean) => {
  if (history) return 'No past shows yet.';
  if (isOwnProfile) return 'Bookmark shows in Industry Now and they\'ll appear here.';
  return 'No saved shows.';
};

export const SavedShows: React.FC<SavedShowsProps> = ({
  userId,
  isOwnProfile = false,
  watchlistPublic = false,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPublic, setIsPublic] = useState(watchlistPublic);
  useEffect(() => { setIsPublic(watchlistPublic); }, [watchlistPublic]);

  const { data: rawSaves = [], isLoading } = useQuery({
    queryKey: ['saved-shows-profile', userId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_profile_watchlist', { p_user_id: userId });
      if (error) throw error;
      return (data ?? []) as WatchlistRow[];
    },
    enabled: !!userId,
  });

  const activeShows = rawSaves.filter(s => !s.run_end || !isPast(parseISO(s.run_end)));
  const historyShows = rawSaves.filter(s => s.run_end && isPast(parseISO(s.run_end)));

  const unsaveMutation = useMutation({
    mutationFn: async (showId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await (supabase.rpc as any)('remove_saved_show', { p_show_id: showId });
      if (error) throw error;
    },
    onMutate: async (showId) => {
      await queryClient.cancelQueries({ queryKey: ['saved-shows-profile', userId] });
      const previous = queryClient.getQueryData<WatchlistRow[]>(['saved-shows-profile', userId]);
      queryClient.setQueryData<WatchlistRow[]>(['saved-shows-profile', userId],
        (old = []) => old.filter(s => s.show_id !== showId)
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success('Removed from watchlist');
      queryClient.invalidateQueries({ queryKey: ['saved-shows-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['saved-show-ids', userId] });
    },
    onError: (_err, _showId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['saved-shows-profile', userId], context.previous);
      }
      toast.error('Failed to remove show');
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await (supabase.rpc as any)('set_watchlist_public', { value });
      if (error) throw error;
    },
    onMutate: (value) => { setIsPublic(value); },
    onSuccess: (_, value) => {
      toast.success(value ? 'Watchlist is now public' : 'Watchlist is now private');
      queryClient.invalidateQueries({ queryKey: ['watchlist-public', userId] });
    },
    onError: (err: any, value) => {
      setIsPublic(!value);
      toast.error(err?.message || 'Failed to update privacy');
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading watchlist…</p>;
  }

  return (
    <div className="space-y-4">
      {isOwnProfile && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            id="watchlist-public"
            checked={isPublic}
            onCheckedChange={(v) => togglePublicMutation.mutate(v)}
            disabled={togglePublicMutation.isPending}
          />
          <Label htmlFor="watchlist-public" className="cursor-pointer select-none">
            {isPublic ? 'Public — others can see this' : 'Private — only you can see this'}
          </Label>
        </div>
      )}

      {rawSaves.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{emptyMessage(false, isOwnProfile)}</p>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              Active
              {activeShows.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5">
                  {activeShows.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
              {historyShows.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                  {historyShows.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeShows.length === 0
              ? <p className="text-sm text-muted-foreground py-2">{emptyMessage(false, isOwnProfile)}</p>
              : <ShowGrid
                  saves={activeShows}
                  isOwnProfile={isOwnProfile}
                  onRemove={(id) => unsaveMutation.mutate(id)}
                  removing={unsaveMutation.isPending}
                />
            }
          </TabsContent>

          <TabsContent value="history">
            {historyShows.length === 0
              ? <p className="text-sm text-muted-foreground py-2">{emptyMessage(true, isOwnProfile)}</p>
              : <ShowGrid
                  saves={historyShows}
                  faded
                  isOwnProfile={isOwnProfile}
                  onRemove={(id) => unsaveMutation.mutate(id)}
                  removing={unsaveMutation.isPending}
                />
            }
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
