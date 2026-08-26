import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Search,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEventRsvps } from '@/hooks/useEventRsvps';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EditPostDialog } from '@/components/feed/EditPostDialog';
import type { FeedItemData } from '@/components/feed/FeedItem';
import { eventPath, identifierFallbackShortId, identifierFallbackUuid } from '@/lib/publicPaths';

type EventRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  created_at: string;
  event_date: string;
  event_type: string | null;
  image_url: string | null;
  link_title: string | null;
  link_url: string | null;
  location: string | null;
  is_paid: boolean;
  user_id: string;
};

type RsvpFilter = 'all' | 'going' | 'cant_make_it';

const csvEscape = (value: string | number | boolean | null | undefined) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const statusLabel = (status: string) => {
  if (status === 'cant_make_it') return "Can't make it";
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const roleLabel = (role: string) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const EventDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const routeState = location.state as { event?: FeedItemData } | null;
  const stateEvent = routeState?.event?.type === 'event' ? routeState.event : null;
  const [searchQuery, setSearchQuery] = useState('');
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const {
    data: event,
    isLoading: eventLoading,
    isError: eventError,
  } = useQuery({
    queryKey: ['event-dashboard-event', eventId, user?.id],
    queryFn: async () => {
      if (!eventId || !user?.id) return null;

      const fallbackId = identifierFallbackUuid(eventId);
      const fallbackShortId = fallbackId ? null : identifierFallbackShortId(eventId);
      const slugWithoutShortId = fallbackShortId ? eventId.replace(new RegExp(`-${fallbackShortId}$`, 'i'), '') : eventId;
      const selectFields = 'id, slug, title, description, created_at, event_date, event_type, image_url, link_title, link_url, location, is_paid, user_id';
      let data: EventRow | null = null;
      let error: { message?: string } | null = null;

      if (fallbackId) {
        const byId = await supabase
          .from('events')
          .select(selectFields)
          .eq('id', fallbackId)
          .maybeSingle();
        data = byId.data as EventRow | null;
        error = byId.error;
      }

      if (!data && !error && fallbackShortId) {
        const byShortId = await supabase
          .from('events')
          .select(selectFields)
          .eq('slug', slugWithoutShortId)
          .maybeSingle();
        data = byShortId.data as EventRow | null;
        error = byShortId.error;

        if (data && !data.id.replace(/-/g, '').toLowerCase().startsWith(fallbackShortId.toLowerCase())) {
          data = null;
        }
      }

      if (!data && !error && !fallbackShortId) {
        const bySlug = await supabase
          .from('events')
          .select(selectFields)
          .eq('slug', slugWithoutShortId)
          .maybeSingle();
        data = bySlug.data as EventRow | null;
        error = bySlug.error;
      }

      console.log('[Inlight Dashboard Debug] Event dashboard lookup', {
        routeEventId: eventId,
        fallbackId,
        fallbackShortId,
        slugWithoutShortId,
        authUserId: user.id,
        foundEventId: data?.id,
        ownerId: data?.user_id,
        error,
      });

      if (error) throw error;
      return data as EventRow;
    },
    enabled: !!eventId && !!user?.id,
  });

  const stateEventRow = useMemo<EventRow | null>(() => {
    if (!stateEvent || !user?.id || stateEvent.user_id !== user.id) return null;

    return {
      id: stateEvent.id,
      slug: stateEvent.slug || null,
      title: stateEvent.title || 'Untitled event',
      description: stateEvent.description || null,
      created_at: stateEvent.created_at,
      event_date: stateEvent.event_date || stateEvent.created_at,
      event_type: stateEvent.event_type || null,
      image_url: stateEvent.image_url || null,
      link_title: stateEvent.link_title || null,
      link_url: stateEvent.link_url || null,
      location: stateEvent.location || null,
      is_paid: Boolean(stateEvent.is_paid),
      user_id: stateEvent.user_id,
    };
  }, [stateEvent, user?.id]);

  const dashboardEvent = event || stateEventRow;
  const userOwnsDashboardEvent = !!user?.id && dashboardEvent?.user_id === user.id;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      console.log('[Inlight Dashboard Debug] Redirecting dashboard visitor because no user session is available', {
        routeEventId: eventId,
      });
      navigate('/feed?tab=events', { replace: true });
    }
  }, [authLoading, eventId, navigate, user]);

  useEffect(() => {
    if (authLoading || eventLoading || !user) return;
    const canUseOwnedStateFallback = Boolean(stateEventRow && stateEventRow.user_id === user.id);
    if ((!canUseOwnedStateFallback && eventError) || !dashboardEvent || !userOwnsDashboardEvent) {
      console.log('[Inlight Dashboard Debug] Redirecting dashboard user', {
        routeEventId: eventId,
        authUserId: user.id,
        foundEventId: dashboardEvent?.id,
        ownerId: dashboardEvent?.user_id,
        eventError,
        hasStateEvent: Boolean(stateEventRow),
        canUseOwnedStateFallback,
      });
      navigate('/feed?tab=events', { replace: true });
    }
  }, [authLoading, dashboardEvent, eventError, eventId, eventLoading, navigate, stateEventRow, user, userOwnsDashboardEvent]);

  const { rsvps, isLoading: rsvpsLoading, goingCount, cantMakeItCount } = useEventRsvps(dashboardEvent?.id || '', {
    includePrivate: true,
  });

  const publicUrl = useMemo(() => {
    if (!dashboardEvent) return '';
    return `${window.location.origin}${eventPath(dashboardEvent)}`;
  }, [dashboardEvent]);

  const eventFeedItem = useMemo<FeedItemData | null>(() => {
    if (!dashboardEvent) return null;

    return {
      id: dashboardEvent.id,
      slug: dashboardEvent.slug,
      type: 'event',
      user_id: dashboardEvent.user_id,
      title: dashboardEvent.title,
      description: dashboardEvent.description,
      image_url: dashboardEvent.image_url,
      link_url: dashboardEvent.link_url,
      link_title: dashboardEvent.link_title,
      created_at: dashboardEvent.created_at,
      event_date: dashboardEvent.event_date,
      event_type: dashboardEvent.event_type,
      location: dashboardEvent.location || undefined,
      is_paid: dashboardEvent.is_paid,
    };
  }, [dashboardEvent]);

  const openPublicEvent = useCallback(() => {
    if (!dashboardEvent || !eventFeedItem) return;
    navigate(eventPath(dashboardEvent), { state: { event: eventFeedItem } });
  }, [dashboardEvent, eventFeedItem, navigate]);

  const filteredRsvps = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rsvps.filter((rsvp) => {
      const matchesFilter = rsvpFilter === 'all' || rsvp.status === rsvpFilter;
      const matchesSearch =
        !normalizedSearch ||
        [rsvp.name, rsvp.email, rsvp.role_type, rsvp.status, rsvp.custom_answer]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      return matchesFilter && matchesSearch;
    });
  }, [rsvps, rsvpFilter, searchQuery]);

  const expectedCount = rsvps.filter((rsvp) => rsvp.status === 'going').length;
  const checkedInCount = rsvps.filter((rsvp) => rsvp.status === 'going' && rsvp.attended).length;

  const checkInMutation = useMutation({
    mutationFn: async ({ rsvpId, attended }: { rsvpId: string; attended: boolean }) => {
      const { error } = await supabase
        .from('event_rsvps')
        .update({
          attended,
          attended_at: attended ? new Date().toISOString() : null,
        })
        .eq('id', rsvpId)
        .eq('event_id', dashboardEvent!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-rsvps', dashboardEvent?.id] });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || 'Could not update check-in status.');
    },
  });

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Public event link copied');
  };

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'RSVP status', 'Role/type', 'Custom answer', 'RSVP date', 'Checked in'];
    const rows = filteredRsvps.map((rsvp) => [
      rsvp.name,
      rsvp.email,
      statusLabel(rsvp.status),
      roleLabel(rsvp.role_type),
      rsvp.custom_answer,
      formatDateTime(rsvp.created_at),
      rsvp.attended ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dashboardEvent?.title || 'event'}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !user || (eventLoading && !stateEventRow) || (!dashboardEvent && !eventError && !!user?.id)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canUseOwnedStateFallback = Boolean(stateEventRow && stateEventRow.user_id === user?.id);
  if (!dashboardEvent || (!canUseOwnedStateFallback && eventError) || !userOwnsDashboardEvent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <Button
              variant="ghost"
              className="mb-3 -ml-3 gap-2"
              onClick={openPublicEvent}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to event
            </Button>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Creator tools</p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">Event Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={openPublicEvent}>
              <ExternalLink className="h-4 w-4" />
              Open public page
            </Button>
            <Button variant="outline" className="gap-2" onClick={copyPublicLink}>
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
            <Button className="gap-2" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit Event
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{dashboardEvent.title}</CardTitle>
                <CardDescription className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDateTime(dashboardEvent.event_date)}
                  </span>
                  {dashboardEvent.location && <span>{dashboardEvent.location}</span>}
                  {dashboardEvent.event_type && <Badge variant="secondary">{dashboardEvent.event_type}</Badge>}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={copyPublicLink}>
                  <Copy className="h-4 w-4" />
                  Public link
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit Event
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard title="Total RSVPs" value={rsvps.length} icon={<Users className="h-4 w-4" />} />
          <MetricCard title="Going" value={goingCount} icon={<CheckCircle2 className="h-4 w-4" />} />
          <MetricCard title="Can't make it" value={cantMakeItCount} icon={<XCircle className="h-4 w-4" />} />
          <MetricCard title="Tickets sold" value="--" note="Stripe future issue" icon={<Ticket className="h-4 w-4" />} />
          <MetricCard title="Revenue" value="$0" note="Stripe future issue" icon={<Ticket className="h-4 w-4" />} />
        </section>

        <section>
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Attendees</CardTitle>
                  <CardDescription>
                    Full RSVP data is visible only to the event creator. {checkedInCount} checked in of {expectedCount} expected.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search attendees..."
                      className="pl-9 sm:w-64"
                    />
                  </div>
                  <Select value={rsvpFilter} onValueChange={(value) => setRsvpFilter(value as RsvpFilter)}>
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="going">Going</SelectItem>
                      <SelectItem value="cant_make_it">Can't make it</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="gap-2" onClick={exportCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rsvpsLoading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredRsvps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No attendees match this view yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role/type</TableHead>
                      <TableHead>Custom answer</TableHead>
                      <TableHead>RSVP date</TableHead>
                      <TableHead>Checked in</TableHead>
                      <TableHead>Check-in action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRsvps.map((rsvp) => (
                      <TableRow key={rsvp.id}>
                        <TableCell className="font-medium">{rsvp.name || 'Inlight Member'}</TableCell>
                        <TableCell>{rsvp.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={rsvp.status === 'going' ? 'default' : 'secondary'}>
                            {statusLabel(rsvp.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{roleLabel(rsvp.role_type)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{rsvp.custom_answer || '-'}</TableCell>
                        <TableCell>{formatDateTime(rsvp.created_at)}</TableCell>
                        <TableCell>{rsvp.attended ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          {rsvp.status === 'going' ? (
                            <Button
                              size="sm"
                              variant={rsvp.attended ? 'outline' : 'default'}
                              onClick={() => checkInMutation.mutate({ rsvpId: rsvp.id, attended: !rsvp.attended })}
                              disabled={checkInMutation.isPending}
                            >
                              {rsvp.attended ? 'Undo' : 'Mark attended'}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not expected</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {eventFeedItem && (
        <EditPostDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ['event-dashboard-event', eventId, user?.id] });
            }
          }}
          item={eventFeedItem}
        />
      )}
    </div>
  );
};

const MetricCard = ({
  title,
  value,
  icon,
  note,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  note?: string;
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground">{value}</p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </CardContent>
  </Card>
);

export default EventDashboardPage;
