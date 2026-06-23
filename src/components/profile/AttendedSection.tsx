import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
  kind: 'event' | 'show';
  source: 'rsvp' | 'ticket' | 'show';
  title: string;
  description: string | null;
  image_url: string | null;
  event_date: string;
  location: string | null;
}

export const AttendedSection: React.FC<AttendedSectionProps> = ({ userId }) => {
  const { data: attended = [], isLoading } = useQuery({
    queryKey: ['attended-events', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profile_attendance', { _user_id: userId });
      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        kind: item.kind === 'show' ? 'show' : 'event',
        source: item.source === 'ticket' ? 'ticket' : item.source === 'show' ? 'show' : 'rsvp',
        title: item.title,
        description: item.description,
        image_url: item.image_url,
        event_date: item.event_date,
        location: item.location,
      })) as AttendedEvent[];
    },
    enabled: !!userId,
  });

  const attendedEvents = attended.filter((item) => item.kind === 'event');
  const attendedShows = attended.filter((item) => item.kind === 'show');

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading attended events…</p>;
  }

  if (attended.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No attended events or shows yet. Tickets/RSVPs appear here once you're checked in, and you can mark past events or shows you've attended using the button above.
      </p>
    );
  }

  const renderCards = (items: AttendedEvent[], emptyText: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground py-2">{emptyText}</p>;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((ev) => (
          <Card
            key={`${ev.source}-${ev.id}`}
            className="overflow-hidden bg-card border-border"
          >
            {ev.image_url ? (
              <img src={ev.image_url} alt={ev.title} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 bg-muted/50 flex items-center justify-center">
                {ev.kind === 'show' ? (
                  <Theater className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                )}
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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Theater className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Shows</h3>
        </div>
        {renderCards(attendedShows, 'No attended shows yet.')}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Events</h3>
        </div>
        {renderCards(attendedEvents, 'No attended events yet.')}
      </div>
    </div>
  );
};
