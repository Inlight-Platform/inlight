import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Send, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('user');
  const { user, loading: authLoading } = useAuth();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | undefined>(userIdParam || undefined);
  const [showMobileChat, setShowMobileChat] = useState(!!userIdParam);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { 
    conversations, 
    loadingConversations, 
    useConversation, 
    sendMessage, 
    markAsRead 
  } = useMessages();

  const { data: messages = [], isLoading: messagesLoading } = useConversation(selectedPartnerId);
  const selectedConversation = conversations.find(c => c.user_id === selectedPartnerId);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedPartnerId && selectedConversation?.unread_count) {
      markAsRead.mutate(selectedPartnerId);
    }
  }, [selectedPartnerId, selectedConversation?.unread_count]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setShowMobileChat(true);
  };

  const handleNewMessage = (userId: string) => {
    setSelectedPartnerId(userId);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedPartnerId) return;
    
    await sendMessage.mutateAsync({ receiverId: selectedPartnerId, content: messageText.trim() });
    setMessageText('');
  };

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => showMobileChat ? handleBackToList() : navigate('/')}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {showMobileChat && selectedConversation ? (
            <div className="flex items-center gap-3">
              <Avatar 
                className="w-10 h-10 cursor-pointer" 
                onClick={() => navigate(`/profile/${selectedPartnerId}`)}
              >
                <AvatarImage src={selectedConversation.avatar_url || undefined} />
                <AvatarFallback>{selectedConversation.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <h1 
                  className="font-semibold cursor-pointer hover:underline"
                  onClick={() => navigate(`/profile/${selectedPartnerId}`)}
                >
                  {selectedConversation.display_name || 'Unknown'}
                </h1>
              </div>
            </div>
          ) : (
            <h1 className="text-2xl font-display font-bold">Messages</h1>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1">
          {/* Sidebar - Conversation List */}
          <div className="w-80 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversations</h2>
              <NewMessageDialog 
                onSelectUser={handleNewMessage}
                trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="w-4 h-4" />
                  </Button>
                }
              />
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1 mb-3">Start a conversation with someone in your network</p>
                  <NewMessageDialog onSelectUser={handleNewMessage} />
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.user_id}
                    onClick={() => handleSelectConversation(conv.user_id)}
                    className={cn(
                      'w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left',
                      selectedPartnerId === conv.user_id && 'bg-accent'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conv.avatar_url || undefined} />
                        <AvatarFallback>{conv.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'font-medium truncate',
                          conv.unread_count > 0 && 'font-semibold'
                        )}>
                          {conv.display_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      </div>
                      <p className={cn(
                        'text-sm truncate',
                        conv.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {conv.last_message.sender_id === user?.id && 'You: '}
                        {conv.last_message.content}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedPartnerId ? (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex',
                          msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2',
                            msg.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className={cn(
                            'text-xs mt-1',
                            msg.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
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
                      disabled={!messageText.trim() || sendMessage.isPending}
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm">Choose from your existing conversations</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden flex-1 flex flex-col">
          {showMobileChat && selectedPartnerId ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-4 py-2',
                          msg.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={cn(
                          'text-xs mt-1',
                          msg.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border pb-20">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
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
                    disabled={!messageText.trim() || sendMessage.isPending}
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1 mb-3">Start a conversation with someone in your network</p>
                  <NewMessageDialog onSelectUser={handleNewMessage} />
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.user_id}
                    onClick={() => handleSelectConversation(conv.user_id)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left border-b border-border"
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conv.avatar_url || undefined} />
                        <AvatarFallback>{conv.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'font-medium truncate',
                          conv.unread_count > 0 && 'font-semibold'
                        )}>
                          {conv.display_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      </div>
                      <p className={cn(
                        'text-sm truncate',
                        conv.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {conv.last_message.sender_id === user?.id && 'You: '}
                        {conv.last_message.content}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
