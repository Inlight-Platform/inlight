import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, BarChart3, Eye, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const numberFormat = new Intl.NumberFormat('en-US');

const formatDuration = (seconds: number) => {
  if (!seconds) return '0s';
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

interface UserCountSummary {
  profiles_total: number;
  distinct_profile_users: number;
  duplicate_profile_rows: number;
  auth_users_total: number;
}

interface UserGrowthRow {
  month: string;
  new_users: number;
  cumulative_users: number;
}

interface DuplicateProfileRow {
  user_id: string;
  profile_count: number;
  profile_ids: string[];
  emails: string[] | null;
  first_created_at: string;
  last_created_at: string;
}

interface AnalyticsSummary {
  visitors: number;
  pageviews: number;
  views_per_visitor: number;
  average_duration_seconds: number;
}

interface PageMetricRow {
  path: string;
  visits: number;
  unique_visitors: number;
  average_duration_seconds: number;
  total_duration_seconds: number;
  last_visited_at: string | null;
}

interface RpcResult<T> {
  data: T | null;
  error: Error | null;
}

interface InsightsRpcClient {
  rpc<T>(name: string, args?: Record<string, unknown>): Promise<RpcResult<T>>;
}

const insightsClient = supabase as unknown as InsightsRpcClient;

const ProductInsightsManager: React.FC = () => {
  const { data: summary, isLoading: summaryLoading } = useQuery<UserCountSummary | null>({
    queryKey: ['admin-user-count-summary'],
    queryFn: async () => {
      const { data, error } = await insightsClient.rpc<UserCountSummary[]>('get_admin_user_count_summary');
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const { data: growth = [], isLoading: growthLoading } = useQuery<UserGrowthRow[]>({
    queryKey: ['admin-user-growth'],
    queryFn: async () => {
      const { data, error } = await insightsClient.rpc<UserGrowthRow[]>('get_admin_user_growth');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: duplicateProfiles = [], isLoading: duplicateLoading } = useQuery<DuplicateProfileRow[]>({
    queryKey: ['admin-duplicate-profiles'],
    queryFn: async () => {
      const { data, error } = await insightsClient.rpc<DuplicateProfileRow[]>('get_admin_profile_duplicate_report');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: analyticsSummary, isLoading: analyticsLoading } = useQuery<AnalyticsSummary | null>({
    queryKey: ['admin-analytics-summary'],
    queryFn: async () => {
      const { data, error } = await insightsClient.rpc<AnalyticsSummary[]>('get_admin_analytics_summary', { days_back: 90 });
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const { data: pageMetrics = [], isLoading: pagesLoading } = useQuery<PageMetricRow[]>({
    queryKey: ['admin-page-metrics'],
    queryFn: async () => {
      const { data, error } = await insightsClient.rpc<PageMetricRow[]>('get_admin_page_metrics', { days_back: 90 });
      if (error) throw error;
      return data || [];
    },
  });

  const chartData = growth.map((row) => ({
    month: new Date(`${row.month}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    newUsers: Number(row.new_users),
    totalUsers: Number(row.cumulative_users),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Total Users
            </div>
            {summaryLoading ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-2 text-3xl font-bold">{numberFormat.format(summary?.distinct_profile_users || 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              Pageviews
            </div>
            {analyticsLoading ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-2 text-3xl font-bold">{numberFormat.format(analyticsSummary?.pageviews || 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Visitors
            </div>
            {analyticsLoading ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-2 text-3xl font-bold">{numberFormat.format(analyticsSummary?.visitors || 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              Pages Per Visitor
            </div>
            {analyticsLoading ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-2 text-3xl font-bold">{Number(analyticsSummary?.views_per_visitor || 0).toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Avg Time Per Page
            </div>
            {analyticsLoading ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-2 text-3xl font-bold">
                {formatDuration(Number(analyticsSummary?.average_duration_seconds || 0))}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Duplicate Rows
            </div>
            {summaryLoading ? <Skeleton className="mt-3 h-8 w-20" /> : (
              <p className="mt-2 text-3xl font-bold">{numberFormat.format(summary?.duplicate_profile_rows || 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            New Users By Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {growthLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="newUsers" name="New users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Top Pages
            <Badge variant="outline">Last 90 days</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pagesLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : pageMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No app page visits tracked yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Unique Visitors</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Total Time</TableHead>
                  <TableHead>Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageMetrics.map((page) => (
                  <TableRow key={page.path}>
                    <TableCell className="font-mono text-xs">{page.path}</TableCell>
                    <TableCell className="text-right">{numberFormat.format(page.visits || 0)}</TableCell>
                    <TableCell className="text-right">{numberFormat.format(page.unique_visitors || 0)}</TableCell>
                    <TableCell className="text-right">{formatDuration(Number(page.average_duration_seconds || 0))}</TableCell>
                    <TableCell className="text-right">{formatDuration(Number(page.total_duration_seconds || 0))}</TableCell>
                    <TableCell>
                      {page.last_visited_at ? new Date(page.last_visited_at).toLocaleDateString() : 'No visits tracked yet'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate Profile Report</CardTitle>
        </CardHeader>
        <CardContent>
          {duplicateLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : duplicateProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No duplicate profile rows found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Last Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicateProfiles.map((profile) => (
                  <TableRow key={profile.user_id}>
                    <TableCell className="font-mono text-xs">{profile.user_id}</TableCell>
                    <TableCell className="text-right">{profile.profile_count}</TableCell>
                    <TableCell>{profile.emails?.join(', ') || 'None'}</TableCell>
                    <TableCell>{new Date(profile.last_created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductInsightsManager;
