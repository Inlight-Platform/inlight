import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, MapPin, Ticket, Theater } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AttendedSectionProps {
  userId: string;
}

interface AttendedEvent {
  id: string;
  source: 'rsvp' | 'ticket' | 'show';
  title: string;
  description: string | null;
  image_url: string | null;
  event_date: string;
  location: string | null;
}

export const AttendedSection: React.FC<AttendedSectionProps> = ({ userId }) => {
  const navigate = useNavigate();

  const { data: attended = [], isLoading } = useQuery({
    queryKey: ['attended-events', userId],
    queryFn: async () => {
      const [rsvpsRes, ticketsRes, showsRes] = await Promise.all([
        // Only count RSVPs that were physically checked in via QR scan
        supabase
          .from('event_rsvps')
          .select('event_id, attended, attended_at, events!inner(id, title, description, image_url, event_date, location)')
          .eq('user_id', userId)
          .eq('attended', true),
        // Only count tickets that were physically scanned at the door
        supabase
          .from('tickets')
          .select('event_id, checked_in_at, events!inner(id, title, description, image_url, event_date, location)')
          .eq('user_id', userId)
          .not('checked_in_at', 'is', null),
        // Self-marked attended shows
        supabase
          .from('saved_shows')
          .select('show_id, attended_at, nyc_shows!inner(id, title, description, poster_url, venue, run_start, run_end)')
          .eq('user_id', userId)
          .eq('attended', true),
      ]);

      const map = new Map<string, AttendedEvent>();

      (rsvpsRes.data || []).forEach((r: any) => {
        if (!r?.events?.id) return;
        map.set(r.events.id, {
          id: r.events.id,
          source: 'rsvp',
          title: r.events.title,
          description: r.events.description,
          image_url: r.events.image_url,
          event_date: r.events.event_date,
          location: r.events.location,
        });
      });

      (ticketsRes.data || []).forEach((t: any) => {
        if (!t?.events?.id) return;
        map.set(t.events.id, {
          id: t.events.id,
          source: 'ticket',
          title: t.events.title,
          description: t.events.description,
          image_url: t.events.image_url,
          event_date: t.events.event_date,
          location: t.events.location,
        });
      });

      (showsRes.data || []).forEach((s: any) => {
        if (!s?.nyc_shows?.id) return;
        map.set(`show-${s.nyc_shows.id}`, {
          id: s.nyc_shows.id,
          source: 'show',
          title: s.nyc_shows.title,
          description: s.nyc_shows.description,
          image_url: s.nyc_shows.poster_url,
          event_date: s.attended_at || s.nyc_shows.run_end || s.nyc_shows.run_start || new Date().toISOString(),
          location: s.nyc_shows.venue,
        });
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      );
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading attended events…</p>;
  }

  if (attended.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No attended events yet. Events appear here once you're checked in at the door.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {attended.map((ev) => (
        <Card
          key={`${ev.source}-${ev.id}`}
          className="overflow-hidden bg-card border-border"
        >
          {ev.image_url ? (
            <img src={ev.image_url} alt={ev.title} className="w-full h-32 object-cover" />
          ) : (
            <div className="w-full h-32 bg-muted/50 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <div className="p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge variant={ev.source === 'ticket' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 gap-1">
                {ev.source === 'ticket' ? <Ticket className="h-2.5 w-2.5" /> : ev.source === 'show' ? <Theater className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                {ev.source === 'ticket' ? 'Ticketed' : ev.source === 'show' ? 'Show' : 'RSVP'}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(ev.event_date), 'MMM d, yyyy')}
              </span>
            </div>
            <h3 className="font-medium text-foreground text-sm leading-tight line-clamp-2">{ev.title}</h3>
            {ev.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{ev.location}</span>
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
