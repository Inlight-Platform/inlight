import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Heart, MapPin, Calendar, Clock, Ticket, Accessibility, 
  ExternalLink, Bell, BellOff, MessageSquare, ThumbsUp, X,
  ChevronRight, Share2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Show } from './ShowCard';

interface ShowDetailSheetProps {
  show: Show | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved: boolean;
  onSave: (showId: string) => void;
  onUnsave: (showId: string) => void;
}

interface Tip {
  id: string;
  tip_type: string;
  content: string;
  helpful_count: number;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const TIP_TYPES = [
  { value: 'general', label: 'General', emoji: '💡' },
  { value: 'seating', label: 'Seating', emoji: '💺' },
  { value: 'rush', label: 'Rush/Lottery', emoji: '🎟️' },
  { value: 'vibe', label: 'Vibe', emoji: '✨' },
  { value: 'food-nearby', label: 'Food Nearby', emoji: '🍽️' },
  { value: 'date-night', label: 'Date Night', emoji: '❤️' },
  { value: 'family-friendly', label: 'Family Friendly', emoji: '👨‍👩‍👧‍👦' },
];

export const ShowDetailSheet: React.FC<ShowDetailSheetProps> = ({
  show,
  isOpen,
  onClose,
  isSaved,
  onSave,
  onUnsave,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTip, setNewTip] = useState('');
  const [tipType, setTipType] = useState('general');

  // Fetch tips for this show
  const { data: tips = [] } = useQuery({
    queryKey: ['show-tips', show?.id],
    queryFn: async () => {
      if (!show?.id) return [];
      const { data, error } = await supabase
        .from('show_tips')
        .select('*')
        .eq('show_id', show.id)
        .order('helpful_count', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles for tips
      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(tip => ({
        ...tip,
        profile: profileMap.get(tip.user_id),
      })) as Tip[];
    },
    enabled: !!show?.id,
  });

  // Fetch user's votes
  const { data: userVotes = [] } = useQuery({
    queryKey: ['user-tip-votes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('tip_votes')
        .select('tip_id')
        .eq('user_id', user.id);
      return data?.map(v => v.tip_id) || [];
    },
    enabled: !!user?.id,
  });

  // Add tip mutation
  const addTipMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !show?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('show_tips')
        .insert({
          show_id: show.id,
          user_id: user.id,
          tip_type: tipType,
          content: newTip.trim(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show-tips', show?.id] });
      setNewTip('');
      setTipType('general');
      toast.success('Tip added! Thanks for sharing 🎭');
    },
    onError: () => {
      toast.error('Could not add tip');
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (tipId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const hasVoted = userVotes.includes(tipId);
      
      if (hasVoted) {
        const { error } = await supabase
          .from('tip_votes')
          .delete()
          .eq('tip_id', tipId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tip_votes')
          .insert({ tip_id: tipId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show-tips', show?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-tip-votes'] });
    },
  });

  if (!show) return null;

  const daysUntilClosing = show.run_end 
    ? differenceInDays(new Date(show.run_end), new Date()) 
    : null;

  const getShowTypeEmoji = (type: string) => {
    switch (type) {
      case 'musical': return '🎵';
      case 'play': return '🎭';
      case 'opera': return '🎼';
      case 'dance': return '💃';
      default: return '🎪';
    }
  };

  const getTipEmoji = (type: string) => {
    return TIP_TYPES.find(t => t.value === type)?.emoji || '💡';
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          {/* Header Image */}
          <div className="relative -mx-6 -mt-6">
            {show.poster_url ? (
              <img 
                src={show.poster_url} 
                alt={show.title}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                <span className="text-8xl">{getShowTypeEmoji(show.show_type)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            
            {/* Floating Actions */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="backdrop-blur-sm"
                onClick={() => isSaved ? onUnsave(show.id) : onSave(show.id)}
              >
                <Heart className={cn("w-5 h-5", isSaved && "fill-current text-red-500")} />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="backdrop-blur-sm"
                onClick={() => {
                  navigator.share?.({ title: show.title, text: show.description || '', url: window.location.href });
                }}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            {/* Closing Warning */}
            {daysUntilClosing !== null && daysUntilClosing > 0 && daysUntilClosing <= 21 && (
              <div className="absolute bottom-4 left-4">
                <Badge className="bg-red-500 text-white animate-pulse">
                  <Clock className="w-3 h-3 mr-1" />
                  Only {daysUntilClosing} days left!
                </Badge>
              </div>
            )}
          </div>

          <SheetTitle className="text-2xl font-display pr-8">
            {show.title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* Quick Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{show.venue}, {show.borough}</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {show.run_start && format(new Date(show.run_start), 'MMM d, yyyy')}
                {show.run_end ? ` – ${format(new Date(show.run_end), 'MMM d, yyyy')}` : ' – Open Run'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{show.show_type}</Badge>
              <Badge variant="outline">{show.category}</Badge>
              <Badge variant="outline">
                {show.price_tier === 'budget' ? '$' : show.price_tier === 'moderate' ? '$$' : '$$$'}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {show.description && (
            <div>
              <p className="text-muted-foreground leading-relaxed">{show.description}</p>
            </div>
          )}

          {/* Rush/Lottery Info */}
          {(show.rush_policy || show.lottery_info) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-amber-400">
                <Ticket className="w-5 h-5" />
                <span className="font-medium">Insider Tip</span>
              </div>
              {show.rush_policy && <p className="text-sm text-amber-200">{show.rush_policy}</p>}
              {show.lottery_info && <p className="text-sm text-amber-200 mt-1">{show.lottery_info}</p>}
            </div>
          )}

          {/* Accessibility */}
          {show.accessibility_features && show.accessibility_features.length > 0 && (
            <div className="flex items-start gap-2">
              <Accessibility className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex flex-wrap gap-1.5">
                {show.accessibility_features.map(feature => (
                  <Badge key={feature} variant="outline" className="text-xs">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {show.official_url && (
              <Button className="flex-1" asChild>
                <a href={show.official_url} target="_blank" rel="noopener noreferrer">
                  Get Tickets
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            )}
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                const title = encodeURIComponent(show.title);
                const location = encodeURIComponent(`${show.venue}, ${show.borough}, NYC`);
                const details = encodeURIComponent(
                  `${show.description || ''}\n\n${show.rush_policy ? `Rush Policy: ${show.rush_policy}` : ''}${show.official_url ? `\n\nTickets: ${show.official_url}` : ''}`
                );
                
                // Use run_start date or default to today
                const startDate = show.run_start 
                  ? new Date(show.run_start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
                  : new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                
                // For all-day event, format as YYYYMMDD
                const dateOnly = show.run_start 
                  ? show.run_start.replace(/-/g, '')
                  : new Date().toISOString().split('T')[0].replace(/-/g, '');
                
                const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateOnly}/${dateOnly}&details=${details}&location=${location}`;
                
                window.open(calendarUrl, '_blank');
              }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Add to Calendar
            </Button>
          </div>

          {/* Community Tips */}
          <Tabs defaultValue="tips" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="tips" className="flex-1">
                <MessageSquare className="w-4 h-4 mr-2" />
                Community Tips ({tips.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tips" className="mt-4 space-y-4">
              {/* Add Tip Form */}
              {user ? (
                <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm font-medium">Share a tip for fellow theatre-goers</p>
                  <Select value={tipType} onValueChange={setTipType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIP_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.emoji} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea 
                    placeholder="e.g., 'Great rush seats in the front mezzanine!' or 'Perfect for a date night'"
                    value={newTip}
                    onChange={(e) => setNewTip(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    size="sm" 
                    onClick={() => addTipMutation.mutate()}
                    disabled={!newTip.trim() || addTipMutation.isPending}
                  >
                    Share Tip
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sign in to share tips with the community
                </p>
              )}

              {/* Tips List */}
              <div className="space-y-3">
                {tips.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">
                    No tips yet. Be the first to share! 🎭
                  </p>
                ) : (
                  tips.map((tip) => (
                    <div 
                      key={tip.id} 
                      className="p-4 bg-card border border-border rounded-xl space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {getTipEmoji(tip.tip_type)} {tip.tip_type.replace('-', ' ')}
                        </Badge>
                        <button
                          onClick={() => user && voteMutation.mutate(tip.id)}
                          disabled={!user}
                          className={cn(
                            "flex items-center gap-1 text-xs transition-colors",
                            userVotes.includes(tip.id) 
                              ? "text-primary" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <ThumbsUp className={cn(
                            "w-3.5 h-3.5",
                            userVotes.includes(tip.id) && "fill-current"
                          )} />
                          {tip.helpful_count}
                        </button>
                      </div>
                      <p className="text-sm">{tip.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {tip.profile?.display_name || 'Theatre lover'} · {format(new Date(tip.created_at), 'MMM d')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ShowDetailSheet;
