import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Briefcase, MessageCircle, MapPin, Clock, MoreHorizontal, Trash2, Theater, EyeOff, ExternalLink, Pencil, UserPlus, FolderKanban, Globe, Users, UserCheck, PartyPopper, Check, ChevronDown, ChevronUp, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { EditPostDialog } from './EditPostDialog';
import { toast } from 'sonner';
import { NetworkDegree } from '@/hooks/useNetworkConnections';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEventRsvps } from '@/hooks/useEventRsvps';
import { cn, capitalizeName } from '@/lib/utils';
import { isEventPast } from '@/lib/eventDates';

export type FeedItemType = 'post' | 'project' | 'event' | 'job' | 'show' | 'open_role';

export interface FeedItemData {
  id: string;
  type: FeedItemType;
  user_id: string;
  content?: string;
  title?: string;
  description?: string;
  image_url?: string | null;
  image_position_x?: number | null;
  image_position_y?: number | null;
  image_zoom?: number | null;
  link_url?: string | null;
  link_title?: string | null;
  created_at: string;
  category?: string | null;
  event_date?: string;
  location?: string;
  event_type?: string;
  is_paid?: boolean;
  price?: number | null;
  currency?: string | null;
  stripe_price_id?: string | null;
  payment_link_url?: string | null;
  // Show-specific fields
  venue?: string;
  borough?: string;
  show_type?: string;
  run_start?: string | null;
  run_end?: string | null;
  is_anonymous?: boolean;
  // Open role specific fields
  role_id?: string;
  project_id?: string;
  project_title?: string;
  project_status?: string;
  visibility?: string;
  source?: 'post' | 'opportunity';
  creator_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface FeedItemProps {
  item: FeedItemData;
  networkDegree: NetworkDegree | null;
  className?: string;
  contentClassName?: string;
  imageContainerClassName?: string;
  imageClassName?: string;
  compactSquare?: boolean;
}

export const FeedItem: React.FC<FeedItemProps> = ({
  item,
  networkDegree,
  className,
  contentClassName,
  imageContainerClassName,
  imageClassName,
  compactSquare = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { canManageEvents, canManageJobs, canManageProjects } = useFeatureAccess();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false);
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpEmail, setRsvpEmail] = useState('');
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);
  const [buyingTicket, setBuyingTicket] = useState(false);
  const [compactTextExpanded, setCompactTextExpanded] = useState(false);

  const isEventItem = item.type === 'event';
  const isPaidEvent = isEventItem && !!item.is_paid;
  const eventHasPassed = isEventPast(item.event_date);
  const eventLinkClosed = isEventItem && eventHasPassed;
  const { goingRsvps, goingCount, submitRsvp } = useEventRsvps(isEventItem ? item.id : '');

  const attendeeUserIds = goingRsvps
    .map((r) => r.user_id)
    .filter((id): id is string => !!id);
  const { data: attendeeProfiles = [] } = useQuery({
    queryKey: ['attendee-profiles', item.id, attendeeUserIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, avatar_url')
        .in('user_id', attendeeUserIds);
      if (error) throw error;
      return data || [];
    },
    enabled: isEventItem && showAttendees && attendeeUserIds.length > 0,
  });
  const avatarByUserId = new Map(attendeeProfiles.map((p) => [p.user_id, p.avatar_url]));

  const isOwner = user?.id === item.user_id;
  const canManageFeedItem =
    isAdmin ||
    ((item.type !== 'event' || canManageEvents) &&
      (item.type !== 'job' || canManageJobs) &&
      (item.type !== 'project' || canManageProjects));
  const canDelete = (isOwner || isAdmin) && canManageFeedItem;
  const supportsInlineEdit = item.type !== 'show' && item.type !== 'open_role' && item.source !== 'opportunity';
  const canEdit = (isOwner || isAdmin) && supportsInlineEdit && canManageFeedItem; // Shows have their own edit flow

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      let error;
      if (!canManageFeedItem) {
        throw new Error(`This beta group cannot delete ${item.type}s.`);
      }
      if (item.type === 'post' || item.type === 'job') {
        ({ error } = await supabase.from('posts').delete().eq('id', item.id));
      } else if (item.type === 'event') {
        ({ error } = await supabase.from('events').delete().eq('id', item.id));
      } else if (item.type === 'project') {
        ({ error } = await supabase.from('projects').delete().eq('id', item.id));
      } else if (item.type === 'show') {
        ({ error } = await supabase.from('nyc_shows').delete().eq('id', item.id));
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed-events'] });
      queryClient.invalidateQueries({ queryKey: ['feed-projects'] });
      queryClient.invalidateQueries({ queryKey: ['feed-shows'] });
      toast.success(`${item.type === 'job' ? 'Job' : item.type === 'show' ? 'Show' : item.type.charAt(0).toUpperCase() + item.type.slice(1)} deleted`);
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to delete. Please try again.');
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const getTypeIcon = () => {
    switch (item.type) {
      case 'project':
        return <FolderKanban className="h-3 w-3" />;
      case 'event':
        return <Calendar className="h-3 w-3" />;
      case 'job':
        return <Briefcase className="h-3 w-3 text-green-500" />;
      case 'show':
        return <Theater className="h-3 w-3 text-pink-500" />;
      case 'open_role':
        return <UserPlus className="h-3 w-3 text-green-500" />;
      default:
        return <MessageCircle className="h-3 w-3" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case 'project':
        return 'shared a project';
      case 'event':
        return 'created an event';
      case 'job':
        return 'posted a job opportunity';
      case 'show':
        return 'added a show';
      case 'open_role':
        return `is looking for a ${item.title}`;
      default:
        return 'posted';
    }
  };

  const handleClick = () => {
    if (item.type === 'project') {
      navigate(`/projects/${item.id}`);
    } else if (item.type === 'event') {
      navigate('/events');
    } else if (item.type === 'show') {
      navigate('/stage-whisper');
    } else if (item.type === 'open_role' && item.project_id) {
      navigate(`/projects/${item.project_id}`);
    }
  };

  const formatPrice = (amount: number, currency = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const handleBuyTicket = async () => {
    if (eventHasPassed) {
      toast.error('Tickets are closed for this past event.');
      return;
    }

    // If a direct payment link exists, auto-RSVP and open it
    if (item.payment_link_url) {
      // Auto-RSVP the logged-in user as "going"
      if (user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .single();
          const ownerEmail = user.email ?? '';
          if (profile && ownerEmail) {
            submitRsvp.mutate({
              event_id: item.id,
              name: profile.display_name || ownerEmail.split('@')[0],
              email: ownerEmail,
              role_type: 'attendee',
              status: 'going',
            });
          }
        } catch (e) {
          // Don't block checkout if RSVP fails
          console.error('Auto-RSVP error:', e);
        }
      }
      window.open(item.payment_link_url, '_blank');
      return;
    }

    if (!isPaidEvent || !item.stripe_price_id) {
      toast.error('Tickets are not yet available for this event.');
      return;
    }

    setBuyingTicket(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-ticket-checkout', {
        body: {
          event_id: item.id,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Checkout link unavailable');

      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start checkout');
      setBuyingTicket(false);
    }
  };

  const getDegreeColor = () => {
    switch (networkDegree) {
      case '1st':
        return 'bg-primary/10 text-primary';
      case '2nd':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const isClickable = item.type === 'project' || item.type === 'event' || item.type === 'show' || item.type === 'open_role';
  
  // For anonymous shows, hide the creator info
  const showAnonymous = item.type === 'show' && item.is_anonymous;
  const displayName = showAnonymous
    ? 'Anonymous'
    : capitalizeName(item.creator_profile?.display_name || '') || 'Inlight Member';
  const avatarUrl = showAnonymous ? undefined : item.creator_profile?.avatar_url;
  const bodyText = item.content || item.description;
  const compactCollapsed = compactSquare && !compactTextExpanded;
  const compactBodyLineCount = bodyText?.split('\n').filter((line) => line.trim()).length || 0;
  const showCompactTextToggle = compactSquare && Boolean(bodyText && (bodyText.length > 90 || compactBodyLineCount > 2));

  return (
    <Card 
      className={cn(
        'bg-card border-border',
        isClickable && 'cursor-pointer hover:shadow-md transition-shadow',
        (item.type === 'job' || item.type === 'open_role') && 'border-l-4 border-l-green-500',
        item.type === 'show' && 'border-l-4 border-l-pink-500',
        compactCollapsed && 'aspect-square overflow-hidden',
        compactSquare && compactTextExpanded && 'overflow-hidden',
        className
      )}
      onClick={isClickable ? handleClick : undefined}
    >
      <CardContent
        className={cn(
          'p-4',
          compactCollapsed && 'flex h-full min-h-0 flex-col p-3',
          compactSquare && compactTextExpanded && 'p-3',
          contentClassName
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar 
            className={`h-10 w-10 ${showAnonymous ? '' : 'cursor-pointer'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!showAnonymous) {
                navigate(`/profile/${item.user_id}`);
              }
            }}
          >
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{showAnonymous ? <EyeOff className="w-4 h-4" /> : (displayName[0] || 'U')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className={`font-medium text-foreground ${showAnonymous ? 'italic text-muted-foreground' : 'cursor-pointer hover:underline'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showAnonymous) {
                    navigate(`/profile/${item.user_id}`);
                  }
                }}
              >
                {displayName}
              </span>
              <span className="text-muted-foreground text-sm">{getTypeLabel()}</span>
              {networkDegree && !showAnonymous && (
                <Badge variant="secondary" className={`text-xs ${getDegreeColor()}`}>
                  {networkDegree}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-muted">
              {getTypeIcon()}
            </div>
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Title (for projects/events) */}
        {item.title && (
          <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
        )}

        {/* Content */}
        {bodyText && (
          <div className={cn(compactSquare ? 'mb-2' : 'mb-3')}>
            <p
              className={cn(
                'text-sm text-foreground whitespace-pre-wrap',
                compactSquare && 'text-xs leading-relaxed',
                compactCollapsed && 'line-clamp-2'
              )}
            >
              {bodyText}
            </p>
            {showCompactTextToggle && (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  setCompactTextExpanded((expanded) => !expanded);
                }}
              >
                {compactTextExpanded ? 'Less' : 'More'}
              </button>
            )}
          </div>
        )}

        {/* Image - skip for open roles */}
        {item.image_url && item.type !== 'open_role' && (() => {
          const posX = item.image_position_x ?? 50;
          const posY = item.image_position_y ?? 50;
          const zoom = item.image_zoom ?? 1;
          const hasPosition = item.image_position_x != null || item.image_position_y != null || (item.image_zoom != null && item.image_zoom !== 1);
          return (
            <div
              className={cn(
                'rounded-lg overflow-hidden mb-3 relative bg-muted',
                !compactSquare && 'aspect-video',
                compactCollapsed && 'mb-0 mt-auto min-h-0 flex-1',
                compactSquare && compactTextExpanded && 'aspect-square mb-0',
                compactSquare && !compactTextExpanded && 'aspect-square',
                imageContainerClassName
              )}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${posX * (1 - zoom)}%`,
                  top: `${posY * (1 - zoom)}%`,
                  right: `${(100 - posX) * (1 - zoom)}%`,
                  bottom: `${(100 - posY) * (1 - zoom)}%`,
                }}
              >
                <img
                  src={item.image_url}
                  alt={item.title || 'Post image'}
                  className={imageClassName}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${posX}% ${posY}%`,
                  }}
                />
              </div>
            </div>
          );
        })()}

        {/* Link display for posts */}
        {item.link_url && !eventLinkClosed && (
          <a
            href={item.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
            {item.link_title || item.link_url}
          </a>
        )}
        {item.link_url && eventLinkClosed && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <ExternalLink className="h-4 w-4" />
            {isPaidEvent ? 'Ticket link closed for this past event' : 'RSVP link closed for this past event'}
          </div>
        )}

        {/* Visibility badge for non-public posts */}
        {item.visibility && item.visibility !== 'public' && (item.type === 'post' || item.type === 'job') && (
          <div className="mb-3">
            <Badge variant="outline" className="text-xs gap-1">
              {item.visibility === 'network' ? (
                <><Users className="h-3 w-3" /> Network Only</>
              ) : (
                <><UserCheck className="h-3 w-3" /> Specific People</>
              )}
            </Badge>
          </div>
        )}

        {item.type === 'project' && (
          <div className="flex items-center gap-2 mb-3">
            {item.category && (
              <Badge variant="outline" className="text-xs">
                {item.category}
              </Badge>
            )}
            {item.project_status === 'archived' && (
              <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                Completed
              </Badge>
            )}
          </div>
        )}

        {/* Event details */}
        {item.type === 'event' && !compactCollapsed && (
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/50">
              {item.event_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {new Date(item.event_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              {item.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{item.location}</span>
                </div>
              )}
              {item.event_type && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {item.event_type}
                </Badge>
              )}
              {isPaidEvent && (
                <Badge className="text-xs bg-primary text-primary-foreground border-0">
                  {typeof item.price === 'number' ? formatPrice(item.price, item.currency || 'usd') : 'Paid Event'}
                </Badge>
              )}
            </div>
            {isPaidEvent && typeof item.price === 'number' && (
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-sm font-semibold text-foreground">
                  {formatPrice(item.price, item.currency || 'usd')}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">per ticket</span>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {isPaidEvent ? (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleBuyTicket();
                  }}
                  disabled={buyingTicket || eventHasPassed}
                >
                  <Ticket className="h-4 w-4 mr-2" />
                  {eventHasPassed ? 'Tickets Closed' : buyingTicket ? 'Redirecting...' : 'Buy Ticket'}
                </Button>
              ) : !rsvpSubmitted ? (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRsvpDialogOpen(true);
                  }}
                  disabled={eventHasPassed}
                >
                  <PartyPopper className="h-4 w-4 mr-2" />
                  {eventHasPassed ? 'RSVP Closed' : 'RSVP'}
                </Button>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 text-sm text-primary font-medium py-1">
                  <Check className="h-4 w-4" />
                  You're on the list!
                </div>
              )}
              {item.event_date && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    const title = encodeURIComponent(item.title || 'Event');
                    const location = encodeURIComponent(item.location || '');
                    const details = encodeURIComponent(item.content || item.description || '');
                    const eventDate = new Date(item.event_date!);
                    const startDate = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000)
                      .toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
                    window.open(calendarUrl, '_blank');
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Add to Calendar
                </Button>
              )}
            </div>

            {/* Attendees dropdown */}
            {goingCount > 0 && (
              <div className="rounded-lg border border-border overflow-hidden mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAttendees(!showAttendees); }}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium text-xs">Attendees ({goingCount})</span>
                  </div>
                  {showAttendees ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                </button>
                {showAttendees && (
                  <div className="border-t border-border max-h-40 overflow-y-auto divide-y divide-border">
                    {goingRsvps.map((rsvp) => {
                      const canOpenProfile = !!rsvp.user_id && avatarByUserId.has(rsvp.user_id);
                      return (
                      <div
                        key={rsvp.id}
                        className={cn(
                          'flex items-center gap-2 p-2',
                          canOpenProfile ? 'cursor-pointer hover:bg-accent/50 transition-colors' : 'cursor-default'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canOpenProfile) navigate(`/profile/${rsvp.user_id}`);
                        }}
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={(rsvp.user_id && avatarByUserId.get(rsvp.user_id)) || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                            {rsvp.name[0]?.toUpperCase() || 'IM'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{rsvp.name || 'Inlight Member'}</span>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RSVP Dialog */}
        {isEventItem && !isPaidEvent && (
          <Dialog open={rsvpDialogOpen} onOpenChange={setRsvpDialogOpen}>
            <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PartyPopper className="w-5 h-5 text-primary" />
                  RSVP
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (eventHasPassed) {
                    toast.error('RSVPs are closed for this past event.');
                    return;
                  }
                  if (!rsvpName.trim() || !rsvpEmail.trim()) {
                    toast.error('Please fill in all fields');
                    return;
                  }
                  submitRsvp.mutate(
                    {
                      event_id: item.id,
                      name: rsvpName.trim(),
                      email: rsvpEmail.trim(),
                      role_type: 'actor',
                      status: 'going',
                    },
                    {
                      onSuccess: () => {
                        toast.success("You're on the list! 🎉");
                        setRsvpSubmitted(true);
                        setRsvpDialogOpen(false);
                        if (user) {
                          supabase.from('messages').insert({
                            sender_id: user.id,
                            receiver_id: item.user_id,
                            content: `📋 RSVP: ${rsvpName.trim()} has RSVP'd to your event "${item.title || 'Event'}".\nEmail: ${rsvpEmail.trim()}`,
                          });
                        }
                      },
                      onError: (error) => toast.error(error?.message || 'Something went wrong. Try again.'),
                    }
                  );
                }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`rsvp-name-${item.id}`}>Name *</Label>
                    <Input
                      id={`rsvp-name-${item.id}`}
                      value={rsvpName}
                      onChange={(e) => setRsvpName(e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`rsvp-email-${item.id}`}>Email *</Label>
                    <Input
                      id={`rsvp-email-${item.id}`}
                      type="email"
                      value={rsvpEmail}
                      onChange={(e) => setRsvpEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitRsvp.isPending || eventHasPassed}>
                  {eventHasPassed ? 'RSVP Closed' : submitRsvp.isPending ? 'Submitting...' : 'Confirm RSVP'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Show details */}
        {item.type === 'show' && (
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-pink-500/10 mt-2">
            {item.venue && (
              <div className="flex items-center gap-2 text-sm">
                <Theater className="h-4 w-4 text-pink-500" />
                <span className="font-medium">{item.venue}</span>
              </div>
            )}
            {item.borough && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{item.borough}</span>
              </div>
            )}
            {item.show_type && (
              <Badge variant="secondary" className="text-xs capitalize">
                {item.show_type}
              </Badge>
            )}
            {item.category && (
              <Badge variant="outline" className="text-xs">
                {item.category}
              </Badge>
            )}
          </div>
        )}

        {/* Open Role details */}
        {item.type === 'open_role' && (
          <div className="space-y-3 mt-2">
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-2 text-sm">
                <FolderKanban className="h-4 w-4 text-green-500" />
                <span className="font-medium">{item.project_title}</span>
              </div>
              {item.project_status && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {item.project_status.replace('-', ' ')}
                </Badge>
              )}
              <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30 text-xs">
                Open Role
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/${item.project_id}`);
                }}
              >
                <FolderKanban className="h-4 w-4 mr-2" />
                View Project
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/${item.project_id}?apply=${item.role_id}`);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Apply Now
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={`Delete this ${item.type === 'job' ? 'job post' : item.type}?`}
        description={`This will permanently delete this ${item.type}. This action cannot be undone.`}
        isPending={deleteMutation.isPending}
      />

      {/* Edit Post Dialog */}
      <EditPostDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={item}
      />
    </Card>
  );
};
