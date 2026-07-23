import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Users } from 'lucide-react';
import SharedItemCard, { parseSharedItem } from '@/components/messages/SharedItemCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useGroupChats } from '@/hooks/useGroupChats';

interface GroupChatThreadProps {
  groupChatId: string;
  groupName: string;
}

const GroupChatThread: React.FC<GroupChatThreadProps> = ({ groupChatId, groupName }) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { useGroupMessages, sendGroupMessage } = useGroupChats();
  const { data: messages = [], isLoading } = useGroupMessages(groupChatId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    await sendGroupMessage.mutateAsync({ groupChatId, content: messageText.trim() });
    setMessageText('');
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, typeof messages>);

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Welcome to {groupName}</p>
            <p className="text-sm">Start the conversation with your team!</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-4">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {date}
                </span>
              </div>
              <div className="space-y-3">
                {msgs.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const showAvatar = !isOwn && (idx === 0 || msgs[idx - 1].sender_id !== msg.sender_id);
                  const showName = showAvatar;

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex items-end gap-2',
                        isOwn ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {!isOwn && (
                        <div className="w-8">
                          {showAvatar && (
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={msg.sender?.avatar_url || undefined} />
                              <AvatarFallback>
                                {msg.sender?.display_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      <div className={cn('max-w-[70%]', !isOwn && !showAvatar && 'ml-10')}>
                        {showName && (
                          <p className="text-xs text-muted-foreground mb-1 ml-1">
                            {msg.sender?.display_name || 'Unknown'}
                          </p>
                        )}
                        {(() => {
                          const sharedItem = parseSharedItem(msg.content);
                          if (sharedItem) {
                            return (
                              <div>
                                <SharedItemCard data={sharedItem} isOwn={isOwn} />
                                <p className={cn(
                                  'text-[10px] mt-1',
                                  isOwn ? 'text-right text-muted-foreground' : 'text-muted-foreground'
                                )}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div
                              className={cn(
                                'px-4 py-2 rounded-2xl',
                                isOwn
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : 'bg-muted rounded-bl-sm'
                              )}
                            >
                              <p className="text-sm break-words">{msg.content}</p>
                              <p className={cn(
                                'text-[10px] mt-1',
                                isOwn ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                              )}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!messageText.trim() || sendGroupMessage.isPending}
          >
            {sendGroupMessage.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default GroupChatThread;
