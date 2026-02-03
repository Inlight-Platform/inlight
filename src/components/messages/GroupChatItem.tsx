import React from 'react';
import { Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface GroupChatItemProps {
  name: string;
  lastMessage?: {
    content: string;
    sender_name?: string;
    created_at: string;
  };
  unreadCount: number;
  isSelected: boolean;
  onClick: () => void;
}

const GroupChatItem: React.FC<GroupChatItemProps> = ({
  name,
  lastMessage,
  unreadCount,
  isSelected,
  onClick,
}) => {
  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffHours < 168) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left',
        isSelected && 'bg-accent'
      )}
    >
      <div className="relative">
        <Avatar className="w-12 h-12 bg-primary/10">
          <AvatarFallback className="bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </AvatarFallback>
        </Avatar>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            'font-medium truncate',
            unreadCount > 0 && 'font-semibold'
          )}>
            {name}
          </span>
          {lastMessage && (
            <span className="text-xs text-muted-foreground shrink-0 ml-2">
              {formatTime(lastMessage.created_at)}
            </span>
          )}
        </div>
        <p className={cn(
          'text-sm truncate',
          unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {lastMessage ? (
            <>
              {lastMessage.sender_name && `${lastMessage.sender_name}: `}
              {lastMessage.content}
            </>
          ) : (
            'No messages yet'
          )}
        </p>
      </div>
    </button>
  );
};

export default GroupChatItem;
