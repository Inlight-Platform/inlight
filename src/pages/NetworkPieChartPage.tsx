import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

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
        .from('profiles')
        .select('user_id, badges')
        .in('user_id', connections);
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
    if (!studios.length || !connectionProfiles.length) return [];

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
  }, [studios, connectionProfiles]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Network Breakdown</h1>
        <p className="text-sm text-muted-foreground mt-1">
          See how your connections are distributed across group affiliations.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Skeleton className="h-72 w-72 rounded-full" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No connections yet</p>
          <p className="text-sm mt-1">Connect with people to see your network breakdown.</p>
        </div>
      ) : (
        <>
          <div className="w-full flex justify-center">
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`,
                    'Connections',
                  ]}
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: '12px', paddingLeft: '16px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Breakdown ({total} connections)
            </h2>
            <div className="grid gap-1.5">
              {chartData
                .sort((a, b) => b.value - a.value)
                .map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm text-foreground">{entry.name}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground tabular-nums">
                      {entry.value} ({total ? ((entry.value / total) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NetworkPieChartPage;
