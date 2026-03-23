import React, { useState, useRef, useEffect } from 'react';
import { useStore, Message } from '@/store/useStore';
import { Send, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatThreadProps {
  threadId: string;
  otherUserId: string;
}

const ChatThread: React.FC<ChatThreadProps> = ({ threadId, otherUserId }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { 
    currentUserId, 
    getUser, 
    getMessages, 
    sendMessage, 
    markMessagesRead,
    setTyping,
    getThread
  } = useStore();

  const otherUser = getUser(otherUserId);
  const messages = getMessages(threadId);
  const thread = getThread(threadId);
  const otherUserTyping = thread?.typingUserId === otherUserId;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherUserTyping]);

  // Mark messages as read when viewing
  useEffect(() => {
    const unreadMessages = messages.filter(
      m => m.senderId !== currentUserId && !m.readAt
    );
    if (unreadMessages.length > 0) {
      markMessagesRead(threadId, currentUserId);
    }
  }, [messages, threadId, currentUserId, markMessagesRead]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      setTyping(threadId, currentUserId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTyping(threadId, undefined);
    }, 2000);
  };

  const handleSend = () => {
    if (!message.trim()) return;

    sendMessage(threadId, currentUserId, message.trim());
    setMessage('');
    setIsTyping(false);
    setTyping(threadId, undefined);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    const date = formatDate(msg.createdAt);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex items-center justify-center my-4">
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {date}
              </span>
            </div>
            <div className="space-y-2">
              {msgs.map((msg) => {
                const isOwn = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-end gap-2',
                      isOwn ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {!isOwn && (
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={otherUser?.avatar} />
                        <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] px-4 py-2 rounded-2xl',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      )}
                    >
                      <p className="text-sm break-words">{msg.content}</p>
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isOwn ? 'justify-end' : 'justify-start'
                      )}>
                        <span className={cn(
                          'text-[10px]',
                          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          msg.readAt ? (
                            <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                          ) : (
                            <Check className="w-3 h-3 text-primary-foreground/70" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {otherUserTyping && (
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={otherUser?.avatar} />
              <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={!message.trim()}
            size="icon"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatThread;
