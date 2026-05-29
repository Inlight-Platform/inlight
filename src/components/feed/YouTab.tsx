import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, UserPlus, Clock, Check, MapPin, Briefcase, ArrowRight, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { capitalizeName } from '@/lib/utils';

interface SuggestedUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  badges: string[] | null;
}

// Deterministic daily seed (changes once per day)
const getDailySeed = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const YouTab: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { following, isMutual } = useNetworkConnections();
  const { sendRequest, hasSentRequestTo } = useConnectionRequests();

  const dailySeed = getDailySeed();

  // Fetch candidate profiles for suggestions + daily match
  const { data: candidates = [] } = useQuery({
    queryKey: ['you-tab-candidates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, headline, bio, location, badges')
        .neq('user_id', user.id)
        .limit(50);
      return (data || []) as SuggestedUser[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 60 * 1000,
  });

  // Fetch opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['you-tab-opportunities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('opportunities')
        .select('id, title, company, location, type, compensation, is_remote, tags')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  const notConnected = useMemo(
    () => candidates.filter(c => !following.includes(c.user_id)),
    [candidates, following]
  );

  const dailySuggestions = useMemo(
    () => seededShuffle(notConnected, dailySeed).slice(0, 3),
    [notConnected, dailySeed]
  );

  const dailyMatch = useMemo(
    () => seededShuffle(notConnected, dailySeed + 7).find(c => !dailySuggestions.some(s => s.user_id === c.user_id)) || null,
    [notConnected, dailySeed, dailySuggestions]
  );

  const dailyOpportunities = useMemo(
    () => seededShuffle(opportunities, dailySeed + 13).slice(0, 3),
    [opportunities, dailySeed]
  );

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const renderConnectButton = (uid: string) => {
    if (isMutual(uid)) {
      return (
        <Button size="sm" variant="outline" disabled className="gap-1.5 text-green-500">
          <Check className="w-3.5 h-3.5" /> Connected
        </Button>
      );
    }
    if (hasSentRequestTo(uid)) {
      return (
        <Button size="sm" variant="outline" disabled className="gap-1.5 text-amber-500">
          <Clock className="w-3.5 h-3.5" /> Pending
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        onClick={(e) => { e.stopPropagation(); sendRequest.mutate(uid); }}
        disabled={sendRequest.isPending}
        className="gap-1.5"
      >
        <UserPlus className="w-3.5 h-3.5" /> Connect
      </Button>
    );
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center">
        <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-2">
          For You · {today}
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-bold">
          Your daily picks
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          A fresh selection of people, opportunities, and one perfect match — refreshed every day.
        </p>
      </div>

      {/* Connection Suggestions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            3 People to meet
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/people')} className="gap-1 text-xs">
            See all <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dailySuggestions.map((p) => (
            <Card
              key={p.user_id}
              className="cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate(`/profile/${p.user_id}`)}
            >
              <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback>{p.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 w-full">
                  <p className="font-semibold truncate">
                    {capitalizeName(p.display_name || 'Unknown')}
                  </p>
                  {p.headline && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.headline}</p>
                  )}
                  {p.location && (
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{p.location}</span>
                    </div>
                  )}
                </div>
                {renderConnectButton(p.user_id)}
              </CardContent>
            </Card>
          ))}
          {dailySuggestions.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-6">
              No new suggestions today. Check back tomorrow.
            </p>
          )}
        </div>
      </section>

      {/* Opportunities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            3 Opportunities for you
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/opportunities')} className="gap-1 text-xs">
            See all <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dailyOpportunities.map((o: any) => (
            <Card
              key={o.id}
              className="cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate('/opportunities')}
            >
              <CardContent className="p-5 space-y-3">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {o.type || 'Opportunity'}
                </Badge>
                <h4 className="font-semibold leading-tight line-clamp-2">{o.title}</h4>
                {o.company && (
                  <p className="text-xs text-muted-foreground">{o.company}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">
                    {o.is_remote ? 'Remote' : o.location || 'Location TBA'}
                  </span>
                </div>
                {o.compensation && (
                  <p className="text-xs font-medium text-foreground">{o.compensation}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {dailyOpportunities.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-6">
              No open opportunities right now.
            </p>
          )}
        </div>
      </section>

      {/* Daily Match */}
      {dailyMatch && (
        <section>
          <div className="text-center mb-4">
            <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-1">
              Daily Match · One person picked for today
            </div>
            <h3 className="text-2xl sm:text-3xl font-display font-bold flex items-center justify-center gap-2">
              <Heart className="w-5 h-5 text-primary fill-primary" />
              Match of the day
            </h3>
          </div>
          <Card
            className="max-w-md mx-auto cursor-pointer hover:shadow-2xl transition-shadow overflow-hidden"
            onClick={() => navigate(`/profile/${dailyMatch.user_id}`)}
          >
            <div className="relative aspect-[4/5] bg-muted">
              {dailyMatch.avatar_url ? (
                <img
                  src={dailyMatch.avatar_url}
                  alt={dailyMatch.display_name || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl text-muted-foreground">
                  {dailyMatch.display_name?.[0] || 'U'}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex justify-between text-white">
                <span className="text-[10px] tracking-[0.3em] uppercase opacity-80">
                  Inlight · Daily Match
                </span>
              </div>
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <div className="font-display text-3xl leading-tight">
                  {capitalizeName(dailyMatch.display_name || 'Unknown')}
                </div>
                {dailyMatch.headline && (
                  <p className="text-sm opacity-80 mt-1 line-clamp-2">{dailyMatch.headline}</p>
                )}
                {dailyMatch.location && (
                  <div className="flex items-center gap-1 text-xs opacity-70 mt-1">
                    <MapPin className="w-3 h-3" /> {dailyMatch.location}
                  </div>
                )}
              </div>
            </div>
            {dailyMatch.bio && (
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground line-clamp-3">{dailyMatch.bio}</p>
              </CardContent>
            )}
            <CardContent className="px-5 pb-5 pt-0 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={(e) => { e.stopPropagation(); navigate(`/profile/${dailyMatch.user_id}`); }}
              >
                View profile
              </Button>
              <div onClick={(e) => e.stopPropagation()}>
                {renderConnectButton(dailyMatch.user_id)}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
};

export default YouTab;