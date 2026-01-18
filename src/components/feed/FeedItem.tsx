import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Briefcase, MessageCircle, MapPin, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NetworkDegree } from '@/hooks/useNetworkConnections';

export type FeedItemType = 'post' | 'project' | 'event' | 'job';

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

  const getTypeIcon = () => {
    switch (item.type) {
      case 'project':
        return <Briefcase className="h-3 w-3" />;
      case 'event':
        return <Calendar className="h-3 w-3" />;
      case 'job':
        return <Briefcase className="h-3 w-3 text-green-500" />;
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
      default:
        return 'posted';
    }
  };

  const handleClick = () => {
    if (item.type === 'project') {
      navigate(`/projects/${item.id}`);
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

  const isClickable = item.type === 'project' || item.type === 'event';

  return (
    <Card 
      className={`bg-card border-border ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${item.type === 'job' ? 'border-l-4 border-l-green-500' : ''}`}
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
          <div className="p-1.5 rounded-full bg-muted">
            {getTypeIcon()}
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
      </CardContent>
    </Card>
  );
};
