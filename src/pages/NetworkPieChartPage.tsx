import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { capitalizeName } from '@/lib/utils';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import PersonCard from '@/components/people/PersonCard';

const COLORS = [
  'hsl(0, 70%, 55%)',    // red
  'hsl(25, 80%, 55%)',   // orange
  'hsl(45, 85%, 50%)',   // gold
  'hsl(80, 60%, 45%)',   // olive
  'hsl(140, 55%, 42%)',  // green
  'hsl(170, 60%, 40%)',  // teal
  'hsl(200, 70%, 50%)',  // sky
  'hsl(220, 65%, 55%)',  // blue
  'hsl(250, 55%, 55%)',  // indigo
  'hsl(275, 55%, 55%)',  // purple
  'hsl(300, 50%, 50%)',  // magenta
  'hsl(330, 60%, 55%)',  // pink
  'hsl(15, 75%, 50%)',   // burnt orange
  'hsl(60, 60%, 45%)',   // yellow-green
  'hsl(185, 60%, 42%)',  // cyan
  'hsl(235, 50%, 60%)',  // periwinkle
  'hsl(350, 65%, 50%)',  // crimson
  'hsl(100, 50%, 45%)',  // lime
  'hsl(155, 50%, 42%)',  // emerald
  'hsl(290, 45%, 55%)',  // violet
  'hsl(0, 0%, 55%)',     // gray (Other)
];

const NetworkPieChartPage: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Fetch current user's profile (for role + school context)
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-network-header', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles_public')
        .select('role, badges, display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch studios
  const { data: studios = [] } = useQuery({
    queryKey: ['studios-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('studios').select('id, name, badge_tag, icon');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch 1st degree connections
  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ['connections', '1st', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc('get_mutual_connections', { target_user_id: user.id });
      if (error) throw error;
      return (data || []).map((d: { user_id: string }) => d.user_id);
    },
    enabled: !!user?.id,
  });

  // Fetch profiles of connections to get their badges
  const { data: connectionProfiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['connection-profiles-badges', connections],
    queryFn: async () => {
      if (!connections.length) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, badges, display_name, role, avatar_url')
        .in('user_id', connections);
      if (error) throw error;
      return data || [];
    },
    enabled: connections.length > 0,
  });

  // Fetch recent posts from connections (for active-this-week + recently active)
  const { data: recentPosts = [] } = useQuery({
    queryKey: ['connection-recent-posts', connections],
    queryFn: async () => {
      if (!connections.length) return [];
      const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('posts')
        .select('user_id, content, created_at')
        .in('user_id', connections)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: connections.length > 0,
  });

  const isLoading = loadingConnections || loadingProfiles;

  // Build suggestions for missing affiliations
  const suggestions = React.useMemo(() => {
    if (!studios.length || !connectionProfiles.length) return [];

    const connectedTags = new Set<string>();
    connectionProfiles.forEach((profile) => {
      (profile.badges || []).forEach((badge: string) => {
        connectedTags.add(badge.replace('#', '').toLowerCase());
      });
    });

    return studios
      .filter((s) => !connectedTags.has(s.badge_tag?.toLowerCase() || ''))
      .map((s) => ({
        name: s.name,
        icon: s.icon || '',
        tag: s.badge_tag || '',
      }));
  }, [studios, connectionProfiles]);

  // Build pie chart data
  const chartData = React.useMemo(() => {
    if (!connections.length) return [];
    if (!studios.length || !connectionProfiles.length) {
      return [
        {
          name: 'Other / No Affiliation',
          value: connections.length,
          color: COLORS[COLORS.length - 1],
        },
      ];
    }

    const counts: Record<string, number> = {};
    studios.forEach((s) => {
      counts[s.badge_tag || s.name] = 0;
    });
    let otherCount = 0;

    connectionProfiles.forEach((profile) => {
      const badges = profile.badges || [];
      if (!badges.length) {
        otherCount++;
        return;
      }
      let matched = false;
      badges.forEach((badge: string) => {
        const tag = badge.replace('#', '').toLowerCase();
        const studio = studios.find(
          (s) => s.badge_tag?.toLowerCase() === tag
        );
        if (studio) {
          counts[studio.badge_tag || studio.name]++;
          matched = true;
        }
      });
      if (!matched) otherCount++;
    });

    const result = studios
      .map((s, i) => ({
        name: `${s.icon || ''} ${s.name}`.trim(),
        value: counts[s.badge_tag || s.name],
        color: COLORS[i % COLORS.length],
      }))
      .filter((d) => d.value > 0);

    if (otherCount > 0) {
      result.push({
        name: 'Other / No Affiliation',
        value: otherCount,
        color: COLORS[COLORS.length - 1],
      });
    }

    return result;
  }, [studios, connectionProfiles, connections.length]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  // Distinct affiliations excluding the Other bucket
  const affiliationCount = chartData.filter(
    (d) => d.name !== 'Other / No Affiliation'
  ).length;

  // Active this week (last 7 days)
  const activeThisWeek = React.useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const ids = new Set<string>();
    recentPosts.forEach((p) => {
      if (new Date(p.created_at).getTime() >= weekAgo) ids.add(p.user_id);
    });
    return ids.size;
  }, [recentPosts]);

  // Most recently active connections (top 3, deduped by user_id)
  const activeConnections = React.useMemo(() => {
    const seen = new Set<string>();
    const ordered: Array<{ user_id: string; lastPost: string }> = [];
    recentPosts.forEach((p) => {
      if (!seen.has(p.user_id)) {
        seen.add(p.user_id);
        ordered.push({ user_id: p.user_id, lastPost: p.created_at });
      }
    });
    return ordered.slice(0, 3).map((entry) => {
      const profile = connectionProfiles.find((cp) => cp.user_id === entry.user_id);
      const studioBadge = (profile?.badges || []).find((b: string) => {
        const tag = b.replace('#', '').toLowerCase();
        return studios.some((s) => s.badge_tag?.toLowerCase() === tag);
      });
      const studio = studioBadge
        ? studios.find(
            (s) =>
              s.badge_tag?.toLowerCase() ===
              studioBadge.replace('#', '').toLowerCase()
          )
        : null;
      const days = Math.max(
        0,
        Math.floor((Date.now() - new Date(entry.lastPost).getTime()) / 86400000)
      );
      const activity =
        days === 0 ? 'Posted today' : days === 1 ? 'Posted yesterday' : `Posted ${days}d ago`;
      return {
        user_id: entry.user_id,
        name: profile?.display_name || 'Member',
        role: profile?.role || '',
        studio: studio?.name || '',
        avatar_url: profile?.avatar_url || '',
        activity,
      };
    });
  }, [recentPosts, connectionProfiles, studios]);

  // Personalized header
  const userRole = (myProfile?.role || '').trim();
  const userSchoolBadge = (myProfile?.badges || []).find((b: string) => {
    const tag = b.replace('#', '').toLowerCase();
    return studios.some((s) => s.badge_tag?.toLowerCase() === tag);
  });
  const userSchoolName = userSchoolBadge ? 'NYU Tisch' : '';
  const hasPersonalization = userRole && userSchoolName;

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div className="space-y-3">
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          Your ecosystem
        </div>
        <h1 className="font-display text-3xl sm:text-4xl leading-tight text-foreground">
          {hasPersonalization ? (
            <>
              Your network as a{' '}
              <span className="font-display">{userRole.toLowerCase()}</span> from{' '}
              {userSchoolName}.
            </>
          ) : (
            <>Your network built around your craft.</>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {connections.length} connection{connections.length === 1 ? '' : 's'} across{' '}
          {affiliationCount} affiliation{affiliationCount === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Connections', value: connections.length },
          { label: 'Affiliations', value: affiliationCount },
          { label: 'Active this week', value: activeThisWeek },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-lg bg-muted/40 px-4 py-4 text-center"
          >
            <div className="font-display text-2xl text-foreground">{m.value}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Active in your network */}
      {activeConnections.length >= 2 && (
        <div className="space-y-3">
          <h2 className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Active in your network
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {activeConnections.map((p) => (
              <div
                key={p.user_id}
                className="rounded-lg bg-muted/40 p-3 flex flex-col items-center text-center gap-1.5"
              >
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-foreground overflow-hidden">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(p.name)
                  )}
                </div>
                <div className="text-sm font-medium text-foreground line-clamp-1">{p.name}</div>
                {(p.role || p.studio) && (
                  <div className="text-[11px] text-muted-foreground line-clamp-1">
                    {[p.role, p.studio].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground line-clamp-1">{p.activity}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Skeleton className="h-72 w-72 rounded-full" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No connections yet</p>
          <p className="text-sm mt-1">Connect with people to see your network breakdown.</p>
        </div>
      ) : (
        <>
          <div className="w-full flex justify-center">
            {(() => {
              const size = isMobile ? 320 : 420;
              const cx = size / 2;
              const cy = size / 2;
              const radius = size * 0.36;
              const maxVal = Math.max(...chartData.map((d) => d.value), 1);
              const nodes = chartData.map((d, i) => {
                const angle = (i / chartData.length) * Math.PI * 2 - Math.PI / 2;
                return {
                  ...d,
                  x: cx + Math.cos(angle) * radius,
                  y: cy + Math.sin(angle) * radius,
                  r: 6 + (d.value / maxVal) * 12,
                };
              });
              return (
                <svg width={size} height={size} className="overflow-visible">
                  {nodes.map((n, i) => (
                    <line
                      key={`line-${i}`}
                      x1={cx}
                      y1={cy}
                      x2={n.x}
                      y2={n.y}
                      stroke={n.color}
                      strokeOpacity="0.35"
                      strokeWidth="1"
                    />
                  ))}
                  {/* center node = you */}
                  <circle cx={cx} cy={cy} r="10" fill="hsl(var(--primary))" />
                  <text x={cx} y={cy + 26} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                    You
                  </text>
                  {nodes.map((n, i) => (
                    <g key={`node-${i}`}>
                      <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} fillOpacity="0.85" />
                      <text
                        x={n.x}
                        y={n.y + n.r + 12}
                        textAnchor="middle"
                        className="fill-foreground text-[10px]"
                      >
                        {n.name.length > 18 ? `${n.name.slice(0, 16)}…` : n.name}
                      </text>
                      <text
                        x={n.x}
                        y={n.y + n.r + 25}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px]"
                      >
                        {n.value} {n.value === 1 ? 'person' : 'people'}
                      </text>
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Grow your network
              </h2>
              <div className="grid gap-2">
                {suggestions.slice(0, 5).map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    className="w-full flex items-center gap-3 py-3 px-4 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                  >
                    <span className="text-base shrink-0">{s.icon || '+'}</span>
                    <span className="text-sm text-foreground flex-1">
                      Connect with more <span className="font-semibold">{s.name}</span> students
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Community discovery (moved from /people) */}
      <div className="-mx-4 pt-4 border-t border-border">
        <PeoplePage />
      </div>
    </div>
  );
};

export default NetworkPieChartPage;
