import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { stubUsers, stubConnections, stubMaterials, stubCredits, stubStories, stubMessages, stubThreads, stubEvents } from '@/data/stubData';
import EventRsvpForm from '@/components/events/EventRsvpForm';
import { ChevronLeft, Calendar, MapPin, Clock, Video, ExternalLink } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const eventTypeColors: Record<string, string> = {
  networking: 'bg-cyan-500/20 text-cyan-400',
  workshop: 'bg-amber-500/20 text-amber-400',
  screening: 'bg-purple-500/20 text-purple-400',
  audition: 'bg-rose-500/20 text-rose-400',
  meetup: 'bg-emerald-500/20 text-emerald-400',
  conference: 'bg-blue-500/20 text-blue-400',
};

const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { users, events, getUser } = useStore();

  // Initialize stub data if empty
  useEffect(() => {
    if (users.length === 0) {
      useStore.setState({
        users: stubUsers,
        connections: stubConnections,
        materials: stubMaterials,
        credits: stubCredits,
        stories: stubStories,
        messages: stubMessages,
        threads: stubThreads,
        events: stubEvents,
      });
    }
  }, [users.length]);

  // Try to find event from Zustand store (stub) first
  const stubEvent = events.find((e) => e.id === eventId);

  // Also try to fetch from DB
  const { data: dbEvent } = useQuery({
    queryKey: ['event-detail', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId!)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!eventId && !stubEvent,
  });

  const event = stubEvent;
  const host = event ? getUser(event.hostId) : null;

  if (!event && !dbEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Event not found</p>
          <Button variant="outline" onClick={() => navigate('/events')}>
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  // Use stub event data (primary flow)
  if (!event) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/events')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display font-bold truncate">{event.title}</h1>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-[1fr,380px] gap-8 max-w-6xl mx-auto">
          {/* Left: Event details */}
          <div className="space-y-6">
            {/* Cover image */}
            <div className="relative rounded-2xl overflow-hidden aspect-[2/1]">
              <img
                src={event.coverImage}
                alt={event.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge className={cn(eventTypeColors[event.type])}>{event.type}</Badge>
                {event.isVirtual && (
                  <Badge variant="secondary" className="gap-1">
                    <Video className="w-3 h-3" />
                    Virtual
                  </Badge>
                )}
              </div>
            </div>

            {/* Title & host */}
            <div className="space-y-3">
              <h2 className="text-3xl font-display font-bold">{event.title}</h2>
              {host && (
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/profile/${host.id}`)}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={host.avatar} />
                    <AvatarFallback>{host.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">Hosted by</p>
                    <p className="font-medium">{host.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Date/Time/Location */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{formatDate(event.date)}</p>
                  <p className="text-sm text-muted-foreground">{formatTime(event.date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">
                    {event.isVirtual ? 'Online Event' : event.location}
                  </p>
                  {!event.isVirtual && (
                    <p className="text-sm text-muted-foreground">{event.address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">About this event</h3>
              <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Right sidebar: RSVP */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <EventRsvpForm eventId={eventId!} />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default EventDetailPage;
