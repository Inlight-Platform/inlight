import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Event, useStore } from '@/store/useStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Video, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: Event;
  compact?: boolean;
}

const eventTypeColors: Record<string, string> = {
  networking: 'bg-cyan-500/20 text-cyan-400',
  workshop: 'bg-amber-500/20 text-amber-400',
  screening: 'bg-purple-500/20 text-purple-400',
  audition: 'bg-rose-500/20 text-rose-400',
  meetup: 'bg-emerald-500/20 text-emerald-400',
  conference: 'bg-blue-500/20 text-blue-400',
};

const EventCard: React.FC<EventCardProps> = ({ event, compact = false }) => {
  const navigate = useNavigate();
  const { getUser, currentUserId, rsvpToEvent, get1stDegree } = useStore();
  
  const host = getUser(event.hostId);
  const myRsvp = event.attendees.find(a => a.userId === currentUserId);
  const goingCount = event.attendees.filter(a => a.status === 'going').length;
  const connections = get1stDegree(currentUserId);
  const connectionsGoing = event.attendees.filter(
    a => a.status === 'going' && connections.some(c => c.id === a.userId)
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleRsvp = (status: 'going' | 'interested') => {
    rsvpToEvent(event.id, currentUserId, status);
  };

  if (compact) {
    return (
      <div 
        className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={() => navigate(`/events/${event.id}`)}
      >
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-xs font-medium text-primary">
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-lg font-bold text-primary">
            {new Date(event.date).getDate()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{event.title}</h4>
          <p className="text-xs text-muted-foreground truncate">
            {event.isVirtual ? 'Virtual' : event.location}
          </p>
        </div>
        <Badge className={cn('shrink-0', eventTypeColors[event.type])}>
          {event.type}
        </Badge>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors">
      {/* Cover Image */}
      <div className="relative h-40 overflow-hidden">
        <img 
          src={event.coverImage} 
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge className={cn(eventTypeColors[event.type])}>
            {event.type}
          </Badge>
        </div>
        {event.isVirtual && (
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="gap-1">
              <Video className="w-3 h-3" />
              Virtual
            </Badge>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-semibold text-white truncate">{event.title}</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Date & Time */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{formatTime(event.date)}</span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {event.isVirtual ? 'Online Event' : event.address}
          </span>
        </div>

        {/* Host */}
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage src={host?.avatar} />
            <AvatarFallback>{host?.name?.[0]}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            Hosted by <span className="text-foreground">{host?.name}</span>
          </span>
        </div>

        {/* Attendees */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {connectionsGoing.slice(0, 3).map((a) => {
                const user = getUser(a.userId);
                return (
                  <Avatar key={a.userId} className="w-6 h-6 border-2 border-card">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground">
              <Users className="w-3 h-3 inline mr-1" />
              {goingCount} going
              {connectionsGoing.length > 0 && (
                <span className="text-primary"> · {connectionsGoing.length} connections</span>
              )}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {event.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>

        {/* RSVP Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant={myRsvp?.status === 'going' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleRsvp('going')}
          >
            {myRsvp?.status === 'going' ? '✓ Going' : 'RSVP'}
          </Button>
          <Button
            size="sm"
            variant={myRsvp?.status === 'interested' ? 'secondary' : 'ghost'}
            onClick={() => handleRsvp('interested')}
          >
            {myRsvp?.status === 'interested' ? '★ Interested' : '☆'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
