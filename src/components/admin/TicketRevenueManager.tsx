import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, Loader2, Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

type TicketRevenueRow = {
  event_id: string;
  event_title: string;
  event_date: string;
  creator_user_id: string;
  creator_name: string | null;
  creator_email: string | null;
  tickets_sold: number;
  gross_revenue: number;
  refunds: number;
  net_revenue: number;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const TicketRevenueManager: React.FC = () => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-ticket-revenue-totals'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_ticket_revenue_totals');
      if (error) throw error;
      return (data || []) as TicketRevenueRow[];
    },
  });

  const totals = useMemo(() => rows.reduce(
    (sum, row) => ({
      tickets: sum.tickets + Number(row.tickets_sold || 0),
      gross: sum.gross + Number(row.gross_revenue || 0),
      refunds: sum.refunds + Number(row.refunds || 0),
      net: sum.net + Number(row.net_revenue || 0),
    }),
    { tickets: 0, gross: 0, refunds: 0, net: 0 }
  ), [rows]);

  const creatorTotals = useMemo(() => {
    const totalsByCreator = new Map<string, TicketRevenueRow & { event_count: number }>();

    rows.forEach((row) => {
      const existing = totalsByCreator.get(row.creator_user_id);
      if (!existing) {
        totalsByCreator.set(row.creator_user_id, {
          ...row,
          tickets_sold: Number(row.tickets_sold || 0),
          gross_revenue: Number(row.gross_revenue || 0),
          refunds: Number(row.refunds || 0),
          net_revenue: Number(row.net_revenue || 0),
          event_count: 1,
        });
        return;
      }

      existing.event_count += 1;
      existing.tickets_sold += Number(row.tickets_sold || 0);
      existing.gross_revenue += Number(row.gross_revenue || 0);
      existing.refunds += Number(row.refunds || 0);
      existing.net_revenue += Number(row.net_revenue || 0);
    });

    return Array.from(totalsByCreator.values()).sort((a, b) => Number(b.net_revenue || 0) - Number(a.net_revenue || 0));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Tickets sold" value={totals.tickets} icon={<Ticket className="h-4 w-4" />} />
        <MetricCard title="Gross revenue" value={formatCurrency(totals.gross)} icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Refunds" value={formatCurrency(totals.refunds)} icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Net revenue" value={formatCurrency(totals.net)} icon={<DollarSign className="h-4 w-4" />} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Creator Totals</CardTitle>
        </CardHeader>
        <CardContent>
          {creatorTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No creator revenue totals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Refunds</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creatorTotals.map((row) => (
                    <TableRow key={row.creator_user_id}>
                      <TableCell>
                        <div className="font-medium">{row.creator_name || 'Inlight creator'}</div>
                        {row.creator_email && <div className="text-xs text-muted-foreground">{row.creator_email}</div>}
                      </TableCell>
                      <TableCell className="text-right">{row.event_count}</TableCell>
                      <TableCell className="text-right">{row.tickets_sold}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(row.gross_revenue || 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(row.refunds || 0))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(row.net_revenue || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Totals</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No native paid ticket revenue yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Refunds</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.event_id}>
                      <TableCell className="font-medium">{row.event_title}</TableCell>
                      <TableCell>
                        <div>{row.creator_name || 'Inlight creator'}</div>
                        {row.creator_email && <div className="text-xs text-muted-foreground">{row.creator_email}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(row.event_date)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{row.tickets_sold}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(row.gross_revenue || 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(row.refunds || 0))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(row.net_revenue || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export default TicketRevenueManager;
