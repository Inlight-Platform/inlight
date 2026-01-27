import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Briefcase, MessageCircle, MapPin, Clock, MoreHorizontal, Trash2, Theater } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { toast } from 'sonner';
import { NetworkDegree } from '@/hooks/useNetworkConnections';

export type FeedItemType = 'post' | 'project' | 'event' | 'job' | 'show';

export interface FeedItemData {
  id: string;
  type: FeedItemType;
  user_id: string;
  content?: string;
  title?: string;
  description?: string;
  image_url?: string | null;
  created_at: string;
  category?: string | null;
  event_date?: string;
  location?: string;
  event_type?: string;
  // Show-specific fields
  venue?: string;
  borough?: string;
  show_type?: string;
  run_start?: string | null;
  run_end?: string | null;
  creator_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface FeedItemProps {
  item: FeedItemData;
  networkDegree: NetworkDegree | null;
}

export const FeedItem: React.FC<FeedItemProps> = ({ item, networkDegree }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isOwner = user?.id === item.user_id;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      let error;
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
        return <Briefcase className="h-3 w-3" />;
      case 'event':
        return <Calendar className="h-3 w-3" />;
      case 'job':
        return <Briefcase className="h-3 w-3 text-green-500" />;
      case 'show':
        return <Theater className="h-3 w-3 text-pink-500" />;
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
      default:
        return 'posted';
    }
  };

  const handleClick = () => {
    if (item.type === 'project') {
      navigate(`/projects/${item.id}`);
    } else if (item.type === 'show') {
      navigate('/stage-whisper');
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

  const isClickable = item.type === 'project' || item.type === 'event' || item.type === 'show';

  return (
    <Card 
      className={`bg-card border-border ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${item.type === 'job' ? 'border-l-4 border-l-green-500' : ''} ${item.type === 'show' ? 'border-l-4 border-l-pink-500' : ''}`}
      onClick={isClickable ? handleClick : undefined}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar 
            className="h-10 w-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${item.user_id}`);
            }}
          >
            <AvatarImage src={item.creator_profile?.avatar_url || undefined} />
            <AvatarFallback>{item.creator_profile?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className="font-medium text-foreground cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${item.user_id}`);
                }}
              >
                {item.creator_profile?.display_name || 'Unknown'}
              </span>
              <span className="text-muted-foreground text-sm">{getTypeLabel()}</span>
              {networkDegree && (
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
            {isOwner && (
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
        {(item.content || item.description) && (
          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">
            {item.content || item.description}
          </p>
        )}

        {/* Image */}
        {item.image_url && (
          <div className="rounded-lg overflow-hidden mb-3">
            <img 
              src={item.image_url} 
              alt={item.title || 'Post image'} 
              className="w-full max-h-80 object-cover"
            />
          </div>
        )}

        {/* Category badge for projects */}
        {item.category && item.type === 'project' && (
          <Badge variant="outline" className="text-xs mb-3">
            {item.category}
          </Badge>
        )}

        {/* Event details */}
        {item.type === 'event' && (
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/50 mt-2">
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
          </div>
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
    </Card>
  );
};
