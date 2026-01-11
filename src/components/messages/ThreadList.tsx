import React from 'react';
import { useStore } from '@/store/useStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ThreadListProps {
  selectedThreadId?: string;
  onSelectThread: (threadId: string, otherUserId: string) => void;
}

const ThreadList: React.FC<ThreadListProps> = ({ selectedThreadId, onSelectThread }) => {
  const { 
    currentUserId, 
    getUser, 
    getUserThreads, 
    getMessages,
    getThread
  } = useStore();

  const threads = getUserThreads(currentUserId);

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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Connect with others to start chatting</p>
          </div>
        ) : (
          threads.map((thread) => {
            const otherUserId = thread.participants.find(id => id !== currentUserId) || '';
            const otherUser = getUser(otherUserId);
            const messages = getMessages(thread.id);
            const lastMessage = messages[messages.length - 1];
            const unreadCount = messages.filter(
              m => m.senderId !== currentUserId && !m.readAt
            ).length;
            const isTyping = thread.typingUserId === otherUserId;

            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id, otherUserId)}
                className={cn(
                  'w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left',
                  selectedThreadId === thread.id && 'bg-accent'
                )}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={otherUser?.avatar} />
                    <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
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
                      {otherUser?.name || 'Unknown'}
                    </span>
                    {lastMessage && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatTime(lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm truncate',
                    unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {isTyping ? (
                      <span className="text-primary italic">typing...</span>
                    ) : lastMessage ? (
                      <>
                        {lastMessage.senderId === currentUserId && 'You: '}
                        {lastMessage.content}
                      </>
                    ) : (
                      'No messages yet'
                    )}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ThreadList;
