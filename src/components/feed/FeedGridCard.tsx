import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Briefcase, FolderKanban, MessageCircle, Theater, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FeedItemData } from './FeedItem';

interface FeedGridCardProps {
  item: FeedItemData;
  onClick: () => void;
}

export const FeedGridCard: React.FC<FeedGridCardProps> = ({ item, onClick }) => {
  const getTypeIcon = () => {
    switch (item.type) {
      case 'project': return <FolderKanban className="h-3 w-3" />;
      case 'event': return <Calendar className="h-3 w-3" />;
      case 'job': return <Briefcase className="h-3 w-3 text-green-500" />;
      case 'show': return <Theater className="h-3 w-3 text-pink-500" />;
      case 'open_role': return <UserPlus className="h-3 w-3 text-green-500" />;
      default: return <MessageCircle className="h-3 w-3" />;
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

  const showAnonymous = item.type === 'show' && item.is_anonymous;
  const displayName = showAnonymous ? 'Anonymous' : (item.creator_profile?.display_name || 'Unknown');
  const avatarUrl = showAnonymous ? undefined : item.creator_profile?.avatar_url;
  const title = item.title || (item.content?.slice(0, 80) + (item.content && item.content.length > 80 ? '…' : ''));
  const subtitle = item.description || item.content;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-card border-border group"
      onClick={onClick}
    >
      {/* Image or colored header */}
      {item.image_url && item.type !== 'open_role' ? (
        <div className="w-full h-28 overflow-hidden">
          <img
            src={item.image_url}
            alt={item.title || 'Feed image'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className={`w-full h-12 flex items-center justify-center ${
          item.type === 'job' || item.type === 'open_role' ? 'bg-green-500/10' :
          item.type === 'show' ? 'bg-pink-500/10' :
          item.type === 'event' ? 'bg-primary/10' :
          item.type === 'project' ? 'bg-accent/50' :
          'bg-muted/50'
        }`}>
          <div className="p-2 rounded-full bg-background/80">
            {getTypeIcon()}
          </div>
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Type badge */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {getTypeLabel()}
          </Badge>
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
          <p className="text-xs text-muted-foreground line-clamp-2">
            {subtitle}
          </p>
        )}

        {/* Creator */}
        <div className="flex items-center gap-1.5 pt-1">
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
