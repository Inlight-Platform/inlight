import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Loader2, MapPin, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { eventPath } from '@/lib/publicPaths';

type TicketRow = {
  id: string;
  amount_paid: number | null;
  attendee_email: string | null;
  checked_in_at: string | null;
  created_at: string;
  event_id: string;
  refunded_amount: number;
  status: string;
  ticket_code: string | null;
};

type EventRow = {
  id: string;
  slug: string | null;
  title: string;
  event_date: string;
  event_type: string | null;
  location: string | null;
  image_url: string | null;
};

type TicketWithEvent = TicketRow & {
  event: EventRow | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Date not set';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

const statusLabel = (status: string) => {
  if (status === 'partially_refunded') return 'Partially refunded';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const statusVariant = (status: string) => {
  if (status === 'confirmed' || status === 'partially_refunded') return 'default' as const;
  if (status === 'pending') return 'secondary' as const;
  return 'outline' as const;
};

const MyTicketsPage: React.FC = () => {
  const { user } = useAuth();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['my-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as TicketWithEvent[];

      const { data: ticketRows, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, amount_paid, attendee_email, checked_in_at, created_at, event_id, refunded_amount, status, ticket_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      const eventIds = Array.from(new Set((ticketRows || []).map((ticket) => ticket.event_id)));
      if (eventIds.length === 0) return [] as TicketWithEvent[];

      const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('id, slug, title, event_date, event_type, location, image_url')
        .in('id', eventIds);

      if (eventsError) throw eventsError;

      const eventById = new Map((eventRows || []).map((event) => [event.id, event as EventRow]));
      return (ticketRows || []).map((ticket) => ({
        ...(ticket as TicketRow),
        event: eventById.get(ticket.event_id) || null,
      }));
    },
    enabled: !!user?.id,
  });

  const activeTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'confirmed' || ticket.status === 'partially_refunded'),
    [tickets]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Ticket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
          <p className="text-sm text-muted-foreground">{activeTickets.length} active ticket{activeTickets.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">You do not have any tickets yet.</p>
            <Button asChild className="mt-4">
              <Link to="/feed?tab=events">Browse events</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => {
            const event = ticket.event;
            const eventHref = event ? eventPath(event) : '/feed?tab=events';
            const paid = Number(ticket.amount_paid || 0);
            const refunded = Number(ticket.refunded_amount || 0);

            return (
              <Card key={ticket.id}>
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{event?.title || 'Event unavailable'}</CardTitle>
                    <CardDescription className="mt-2 flex flex-wrap items-center gap-3">
                      {event?.event_date && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {formatDateTime(event.event_date)}
                        </span>
                      )}
                      {event?.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <div>
                      <p className="font-medium text-foreground">Ticket code</p>
                      <p className="font-mono">{ticket.ticket_code || 'Pending'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Paid</p>
                      <p>{formatCurrency(paid)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Refunded</p>
                      <p>{formatCurrency(refunded)}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline">
                    <Link to={eventHref}>Open event</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyTicketsPage;
