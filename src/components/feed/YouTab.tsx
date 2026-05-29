import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, UserPlus, Clock, Check, MapPin, Briefcase, ArrowRight, Heart, Compass, BookOpen, Calendar, FolderPlus, Users, Bookmark, BookmarkCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { useSavedItems, SaveItemInput } from '@/hooks/useSavedItems';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { capitalizeName } from '@/lib/utils';
import { COMPLEMENTARY } from '@/data/disciplines';

// A small curated set of resources used for the daily "specific resource" pick.
// Keeping this inline avoids reaching into the full ResourcesPage list.
const CURATED_RESOURCES: { name: string; description: string; url: string; category: string }[] = [
  { name: 'Backstage', description: 'Casting calls and audition notices.', url: 'https://www.backstage.com', category: 'Casting' },
  { name: 'The Black List', description: 'Screenplay hosting and industry access.', url: 'https://blcklst.com', category: 'Scripts' },
  { name: 'Film Independent', description: 'Grants, labs, and Spirit Awards programs.', url: 'https://www.filmindependent.org', category: 'Education' },
  { name: 'No Film School', description: 'Filmmaking tutorials and industry insights.', url: 'https://nofilmschool.com', category: 'Education' },
  { name: 'Playbill', description: 'Broadway news, reviews, and show listings.', url: 'https://www.playbill.com', category: 'News' },
  { name: 'Broadway World', description: 'Theatre news and a national job board.', url: 'https://www.broadwayworld.com', category: 'News' },
  { name: 'New Play Exchange', description: 'Database of new plays by living writers.', url: 'https://newplayexchange.org', category: 'Scripts' },
  { name: 'Sundance Co//ab', description: 'Educational courses from Sundance Institute.', url: 'https://collab.sundance.org', category: 'Education' },
  { name: 'Stage 32', description: 'Networking platform for film professionals.', url: 'https://www.stage32.com', category: 'Networking' },
];

interface SuggestedUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  badges: string[] | null;
  primary_discipline?: string | null;
  secondary_disciplines?: string[] | null;
  goals?: string[] | null;
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
  const { isSaved, getSavedItem, toggleSave } = useSavedItems();

  const dailySeed = getDailySeed();

  // Current user's survey
  const { data: mySurvey } = useQuery({
    queryKey: ['you-tab-survey', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('primary_discipline, secondary_disciplines, goals, display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch candidate profiles for suggestions + daily match
  const { data: candidates = [] } = useQuery({
    queryKey: ['you-tab-candidates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, headline, bio, location, badges, primary_discipline, secondary_disciplines, goals')
        .neq('user_id', user.id)
        .limit(200);
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
    () => candidates.filter((c) => !following.includes(c.user_id)),
    [candidates, following]
  );

  // Score candidates against the current user's survey
  const scored = useMemo(() => {
    const myPrimary = mySurvey?.primary_discipline || null;
    const mySecondary = (mySurvey?.secondary_disciplines as string[]) || [];
    const myGoals = (mySurvey?.goals as string[]) || [];
    const wantsCollab =
      myGoals.includes('Finding collaborators') ||
      myGoals.includes('Starting a new project');
    const complements = myPrimary ? COMPLEMENTARY[myPrimary] || [] : [];

    return notConnected
      .map((c) => {
        let score = 0;
        const cPrimary = c.primary_discipline || null;
        const cSecondary = (c.secondary_disciplines as string[]) || [];
        const cGoals = (c.goals as string[]) || [];

        // Complementary primary discipline (for collaboration goals)
        if (wantsCollab && cPrimary && complements.includes(cPrimary)) score += 5;
        // Shared secondary disciplines
        const sharedSecondary = mySecondary.filter((d) => cSecondary.includes(d)).length;
        score += sharedSecondary * 2;
        // Shared goals
        const sharedGoals = myGoals.filter((g) => cGoals.includes(g)).length;
        score += sharedGoals * 2;
        // Has set up survey
        if (cPrimary) score += 1;
        // Has avatar / headline (quality boost)
        if (c.avatar_url) score += 1;
        if (c.headline) score += 1;

        return { c, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [notConnected, mySurvey]);

  // Take the top-scoring pool, then deterministically shuffle for daily rotation
  const dailySuggestions = useMemo(() => {
    const pool = scored.slice(0, 20).map((s) => s.c);
    return seededShuffle(pool, dailySeed).slice(0, 3);
  }, [scored, dailySeed]);

  const dailyMatch = useMemo(() => {
    // Highest scoring candidate not already in the suggestions
    const usedIds = new Set(dailySuggestions.map((s) => s.user_id));
    const topPool = scored
      .filter((s) => !usedIds.has(s.c.user_id))
      .slice(0, 5)
      .map((s) => s.c);
    return seededShuffle(topPool, dailySeed + 7)[0] || null;
  }, [scored, dailySeed, dailySuggestions]);

  const dailyOpportunities = useMemo(
    () => seededShuffle(opportunities, dailySeed + 13).slice(0, 3),
    [opportunities, dailySeed]
  );

  // Pick a specific resource for the day (used in Daily Actions and Explorations)
  const dailyResource = useMemo(
    () => seededShuffle(CURATED_RESOURCES, dailySeed + 31)[0],
    [dailySeed]
  );

  // "Your Daily Actions" — mapped from goals.
  // Post-style actions route to /feed?compose=... so the user lands in the
  // Create-a-Post dialog instead of a separate page.
  const dailyActions = useMemo(() => {
    const myGoals = (mySurvey?.goals as string[]) || [];
    const all: { key: string; title: string; description: string; icon: React.ReactNode; path: string; goals: string[] }[] = [
      {
        key: 'project',
        title: 'Post a project',
        description: 'Open roles, share the vision, and start a team.',
        icon: <FolderPlus className="w-4 h-4" />,
        path: '/feed?compose=project',
        goals: ['Starting a new project', 'Finding collaborators'],
      },
      {
        key: 'event',
        title: 'Host an event',
        description: 'Bring your community together IRL or online.',
        icon: <Calendar className="w-4 h-4" />,
        path: '/feed?compose=event',
        goals: ['Building my community'],
      },
      {
        key: 'service',
        title: 'Offer a service',
        description: 'Share what you do — coaching, editing, sessions.',
        icon: <Briefcase className="w-4 h-4" />,
        path: '/feed?compose=job',
        goals: ['Building my community', 'Finding collaborators'],
      },
      {
        key: 'resource',
        title: `Read: ${dailyResource.name}`,
        description: dailyResource.description,
        icon: <BookOpen className="w-4 h-4" />,
        path: dailyResource.url,
        goals: ['Finding resources & tools', 'Learning about the industry'],
      },
      {
        key: 'crossdept',
        title: 'Cross-department networking',
        description: 'Meet people outside your discipline.',
        icon: <Users className="w-4 h-4" />,
        path: '/people',
        goals: ['Building my community', 'Learning about the industry'],
      },
    ];
    const ranked = all
      .map((a) => ({ a, score: a.goals.filter((g) => myGoals.includes(g)).length }))
      .sort((x, y) => y.score - x.score);
    const pool = ranked.filter((r) => r.score > 0).map((r) => r.a);
    const fallback = ranked.map((r) => r.a);
    return (pool.length >= 3 ? pool : [...pool, ...fallback.filter((a) => !pool.includes(a))]).slice(0, 3);
  }, [mySurvey, dailyResource]);

  // Explorations — features the user might not know about.
  // One slot is always a specific resource (savable); the rest are actions
  // that route to the Create-a-Post dialog or another contextual page.
  const explorations = useMemo(() => {
    const exploreResource = seededShuffle(
      CURATED_RESOURCES.filter((r) => r.name !== dailyResource.name),
      dailySeed + 47
    )[0];

    const items: {
      key: string;
      title: string;
      description: string;
      icon: React.ReactNode;
      path: string;
      saveData?: SaveItemInput;
    }[] = [
      {
        key: 'explore-resource',
        title: exploreResource.name,
        description: exploreResource.description,
        icon: <BookOpen className="w-4 h-4" />,
        path: exploreResource.url,
        saveData: {
          item_type: 'resource',
          item_title: exploreResource.name,
          item_url: exploreResource.url,
          item_metadata: { description: exploreResource.description, category: exploreResource.category },
        },
      },
      {
        key: 'explore-project',
        title: 'Post a project',
        description: 'Spin up a new production and recruit your team.',
        icon: <FolderPlus className="w-4 h-4" />,
        path: '/feed?compose=project',
      },
      {
        key: 'explore-service',
        title: 'Offer a service',
        description: 'List a gig — coaching, editing, mixing, design.',
        icon: <Briefcase className="w-4 h-4" />,
        path: '/feed?compose=job',
      },
      {
        key: 'explore-event',
        title: 'Host an event',
        description: 'Mixers, screenings, table reads — your turn.',
        icon: <Calendar className="w-4 h-4" />,
        path: '/feed?compose=event',
      },
      {
        key: 'explore-people',
        title: 'Meet new disciplines',
        description: 'Find collaborators outside your usual circle.',
        icon: <Users className="w-4 h-4" />,
        path: '/people',
      },
    ];
    // Don't duplicate the daily actions
    const usedPaths = new Set(dailyActions.map((a) => a.path));
    const filtered = items.filter((i) => !usedPaths.has(i.path));
    const pool = filtered.length >= 3 ? filtered : items;
    // Always keep the resource exploration if present
    const resourceItem = pool.find((i) => i.key === 'explore-resource');
    const rest = seededShuffle(pool.filter((i) => i.key !== 'explore-resource'), dailySeed + 21);
    const ordered = resourceItem ? [resourceItem, ...rest] : rest;
    return ordered.slice(0, 3);
  }, [dailyActions, dailySeed, dailyResource]);

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

  // Small bookmark toggle overlay used in the upper-right of every savable card.
  const SaveIcon: React.FC<{ data: SaveItemInput; className?: string }> = ({ data, className = '' }) => {
    const saved = isSaved(data.item_type, data.item_title, data.item_url);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSave(data);
        }}
        className={`absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 hover:bg-background transition ${className}`}
        aria-label={saved ? 'Remove from saves' : 'Save'}
      >
        {saved ? (
          <BookmarkCheck className="w-4 h-4 text-primary" />
        ) : (
          <Bookmark className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
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
          {mySurvey?.primary_discipline
            ? `Curated for a ${mySurvey.primary_discipline.toLowerCase()} — refreshed every day.`
            : 'A fresh selection of people, opportunities, and one perfect match — refreshed every day.'}
        </p>
      </div>

      {/* Section 1: Connect Today */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Connect today
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/people')} className="gap-1 text-xs">
            See all <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dailySuggestions.map((p) => (
            <Card
              key={p.user_id}
              className="relative cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate(`/profile/${p.user_id}`)}
            >
              <SaveIcon
                data={{
                  item_type: 'person',
                  item_id: p.user_id,
                  item_title: p.display_name || 'Unknown',
                  item_url: `/profile/${p.user_id}`,
                  item_metadata: {
                    headline: p.headline,
                    avatar_url: p.avatar_url,
                    location: p.location,
                  },
                }}
              />
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

      {/* Section 2: Your Daily Actions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            Your daily actions
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dailyActions.map((a) => (
            <Card
              key={a.key}
              className="cursor-pointer hover:shadow-xl transition-shadow group"
              onClick={() => navigate(a.path)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {a.icon}
                </div>
                <h4 className="font-semibold leading-tight">{a.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                <div className="text-xs text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  Start <ArrowRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Opportunities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            Opportunities for you
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/opportunities')} className="gap-1 text-xs">
            See all <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {dailyOpportunities.map((o: any) => (
            <Card
              key={o.id}
              className="relative cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate('/opportunities')}
            >
              <SaveIcon
                data={{
                  item_type: 'job',
                  item_id: o.id,
                  item_title: o.title,
                  item_url: `/opportunities`,
                  item_metadata: {
                    company: o.company,
                    location: o.location,
                    type: o.type,
                    is_remote: o.is_remote,
                    compensation: o.compensation,
                  },
                }}
              />
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

      {/* Section 4: Explorations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            3 Explorations
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {explorations.map((e) => (
            <Card
              key={e.path + e.title}
              className="cursor-pointer hover:shadow-xl transition-shadow group bg-muted/30"
              onClick={() => navigate(e.path)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="h-9 w-9 rounded-full bg-background text-primary flex items-center justify-center border border-border">
                  {e.icon}
                </div>
                <h4 className="font-semibold leading-tight">{e.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                <div className="text-xs text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  Explore <ArrowRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Section 3: Match of the Day */}
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