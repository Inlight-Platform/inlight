import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Briefcase, FolderKanban, MessageCircle, Theater, UserPlus, Users, UserCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FeedItemData } from './FeedItem';

interface FeedGridCardProps {
  item: FeedItemData;
  onClick: () => void;
}

export const FeedGridCard: React.FC<FeedGridCardProps> = ({ item, onClick }) => {
  const getTypeIcon = () => {
    switch (item.type) {
      case 'project': return <FolderKanban className="h-4 w-4" />;
      case 'event': return <Calendar className="h-4 w-4" />;
      case 'job': return <Briefcase className="h-4 w-4 text-green-500" />;
      case 'show': return <Theater className="h-4 w-4 text-pink-500" />;
      case 'open_role': return <UserPlus className="h-4 w-4 text-green-500" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case 'project': return 'Project';
      case 'event': return 'Event';
      case 'job': return 'Opportunity';
      case 'show': return 'Show';
      case 'open_role': return 'Open Role';
      default: return 'Update';
    }
  };

  // Show image area for ANY item that has an image (including update posts), plus projects/events/shows (which fall back to a placeholder icon)
  const hasImage = !!item.image_url;
  const showImage = hasImage || item.type === 'project' || item.type === 'event' || item.type === 'show';
  const showAnonymous = item.type === 'show' && item.is_anonymous;
  const displayName = showAnonymous ? 'Anonymous' : item.creator_profile?.display_name || 'Unknown';
  const avatarUrl = showAnonymous ? undefined : item.creator_profile?.avatar_url;
  const title = item.title || item.content?.slice(0, 80) + (item.content && item.content.length > 80 ? '…' : '');
  const subtitle = item.description || item.content;

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-card border-border group flex flex-col",
        showImage ? "h-[280px]" : ""
      )}
      onClick={onClick}
    >
      {/* Image header - shown whenever the item has an image_url, with a placeholder icon for project/event/show without one */}
      {showImage && (
        <div className="w-full h-32 overflow-hidden flex-shrink-0 bg-muted">
          {hasImage ? (
            <img
              src={item.image_url!}
              alt={item.title || item.content?.slice(0, 40) || 'Feed image'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              style={{ objectPosition: `${item.image_position_x ?? 50}% ${item.image_position_y ?? 50}%` }}
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full bg-muted/50 flex items-center justify-center">
              <div className="p-3 rounded-full bg-background/80">
                {getTypeIcon()}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-3 space-y-1.5 flex-1 flex flex-col min-h-0">
        {/* Type badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {getTypeLabel()}
            </Badge>
            {item.type === 'project' && item.project_status === 'archived' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-500">
                Completed
              </Badge>
            )}
            {item.visibility && item.visibility !== 'public' && (item.type === 'post' || item.type === 'job') && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                {item.visibility === 'network' ? <Users className="h-2.5 w-2.5" /> : <UserCheck className="h-2.5 w-2.5" />}
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-medium text-foreground text-sm leading-tight line-clamp-2">
          {title}
        </h3>

        {/* Subtitle preview */}
        {subtitle && subtitle !== title && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {subtitle}
          </p>
        )}

        {/* Creator - pushed to bottom */}
        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-[9px]">
              {displayName[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground truncate">
            {displayName}
          </span>
        </div>
      </div>
    </Card>
  );
};
