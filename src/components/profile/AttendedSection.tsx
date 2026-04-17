import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AttendedSectionProps {
  userId: string;
}

interface AttendedEvent {
  id: string;
  source: 'rsvp' | 'ticket';
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
      const [rsvpsRes, ticketsRes] = await Promise.all([
        supabase
          .from('event_rsvps')
          .select('event_id, status, created_at, events!inner(id, title, description, image_url, event_date, location)')
          .eq('user_id', userId)
          .eq('status', 'going'),
        supabase
          .from('tickets')
          .select('event_id, status, created_at, events!inner(id, title, description, image_url, event_date, location)')
          .eq('user_id', userId)
          .eq('status', 'paid'),
      ]);

      const map = new Map<string, AttendedEvent>();

      (rsvpsRes.data || []).forEach((r: any) => {
        if (!r.events) return;
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
        if (!t.events) return;
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
        No attended events yet. RSVPs and tickets will appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {attended.map((ev) => (
        <Card
          key={`${ev.source}-${ev.id}`}
          className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-card border-border"
          onClick={() => navigate(`/events/${ev.id}`)}
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
                {ev.source === 'ticket' ? <Ticket className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                {ev.source === 'ticket' ? 'Ticketed' : 'RSVP'}
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
