import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Send, Loader2, Plus, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useGroupChats } from '@/hooks/useGroupChats';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';
import GroupChatItem from '@/components/messages/GroupChatItem';
import GroupChatThread from '@/components/messages/GroupChatThread';
import SharedItemCard, { parseSharedItem } from '@/components/messages/SharedItemCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type ChatType = 'dm' | 'group';

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get('user');
  const { user, loading: authLoading } = useAuth();

  const [selectedId, setSelectedId] = useState<string | undefined>(userIdParam || undefined);
  const [chatType, setChatType] = useState<ChatType>(userIdParam ? 'dm' : 'dm');
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

  const { groupChats, loadingGroupChats } = useGroupChats();

  const { data: messages = [], isLoading: messagesLoading } = useConversation(
    chatType === 'dm' ? selectedId : undefined
  );
  
  // Get conversation from list OR fetch profile for new conversations
  const existingConversation = conversations.find(c => c.user_id === selectedId);
  const selectedGroupChat = groupChats.find(gc => gc.id === selectedId);
  
  // Fetch profile for new conversations that aren't in the list yet
  const { data: newUserProfile } = useQuery({
    queryKey: ['message-partner-profile', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const { data } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .eq('user_id', selectedId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedId && !existingConversation && chatType === 'dm',
  });

  // Use existing conversation data or fetched profile
  const selectedConversation = existingConversation || (newUserProfile ? {
    user_id: newUserProfile.user_id,
    display_name: newUserProfile.display_name,
    avatar_url: newUserProfile.avatar_url,
    unread_count: 0,
  } : null);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (chatType === 'dm' && selectedId && existingConversation?.unread_count) {
      markAsRead.mutate(selectedId);
    }
  }, [selectedId, existingConversation?.unread_count, chatType]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (partnerId: string) => {
    setSelectedId(partnerId);
    setChatType('dm');
    setShowMobileChat(true);
  };

  const handleSelectGroupChat = (groupChatId: string) => {
    setSelectedId(groupChatId);
    setChatType('group');
    setShowMobileChat(true);
  };

  const handleNewMessage = (userId: string) => {
    setSelectedId(userId);
    setChatType('dm');
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedId || chatType !== 'dm') return;
    
    await sendMessage.mutateAsync({ receiverId: selectedId, content: messageText.trim() });
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

  // Combine and sort all chats by last activity
  const allChats = [
    ...conversations.map(c => ({
      type: 'dm' as const,
      id: c.user_id,
      name: c.display_name || 'Unknown',
      avatar_url: c.avatar_url,
      last_activity: c.last_message?.created_at || '',
      unread_count: c.unread_count,
      last_message: c.last_message,
    })),
    ...groupChats.map(gc => ({
      type: 'group' as const,
      id: gc.id,
      name: gc.name,
      avatar_url: null,
      last_activity: gc.last_message?.created_at || gc.updated_at,
      unread_count: gc.unread_count,
      last_message: gc.last_message,
    })),
  ].sort((a, b) => {
    if (!a.last_activity) return 1;
    if (!b.last_activity) return -1;
    return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
  });

  const isLoading = loadingConversations || loadingGroupChats;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderHeader = () => {
    if (showMobileChat) {
      if (chatType === 'group' && selectedGroupChat) {
        return (
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 bg-primary/10">
              <AvatarFallback className="bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold">{selectedGroupChat.name}</h1>
              <p className="text-xs text-muted-foreground">Team Chat</p>
            </div>
          </div>
        );
      } else if (chatType === 'dm' && selectedConversation) {
        return (
          <div className="flex items-center gap-3">
            <Avatar 
              className="w-10 h-10 cursor-pointer" 
              onClick={() => navigate(`/profile/${selectedId}`)}
            >
              <AvatarImage src={selectedConversation.avatar_url || undefined} />
              <AvatarFallback>{selectedConversation.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h1 
                className="font-semibold cursor-pointer hover:underline"
                onClick={() => navigate(`/profile/${selectedId}`)}
              >
                {selectedConversation.display_name || 'Unknown'}
              </h1>
            </div>
          </div>
        );
      }
    }
    return <h1 className="text-2xl font-display font-bold">Messages</h1>;
  };

  const renderChatList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (allChats.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No conversations yet</p>
          <p className="text-xs mt-1 mb-3">Start a conversation with someone in your network</p>
          <NewMessageDialog onSelectUser={handleNewMessage} />
        </div>
      );
    }

    return allChats.map((chat) => {
      if (chat.type === 'group') {
        return (
          <GroupChatItem
            key={`group-${chat.id}`}
            name={chat.name}
            lastMessage={chat.last_message ? {
              content: chat.last_message.content,
              sender_name: chat.last_message.sender_name,
              created_at: chat.last_message.created_at,
            } : undefined}
            unreadCount={chat.unread_count}
            isSelected={selectedId === chat.id && chatType === 'group'}
            onClick={() => handleSelectGroupChat(chat.id)}
          />
        );
      }

      return (
        <button
          key={`dm-${chat.id}`}
          onClick={() => handleSelectConversation(chat.id)}
          className={cn(
            'w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left',
            selectedId === chat.id && chatType === 'dm' && 'bg-accent'
          )}
        >
          <div className="relative">
            <Avatar className="w-12 h-12">
              <AvatarImage src={chat.avatar_url || undefined} />
              <AvatarFallback>{chat.name[0] || 'U'}</AvatarFallback>
            </Avatar>
            {chat.unread_count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {chat.unread_count}
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className={cn(
                'font-medium truncate',
                chat.unread_count > 0 && 'font-semibold'
              )}>
                {chat.name}
              </span>
              {chat.last_message && (
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatTime(chat.last_message.created_at)}
                </span>
              )}
            </div>
            <p className={cn(
              'text-sm truncate',
              chat.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {chat.last_message ? (
                <>
                  {chat.last_message.sender_id === user?.id && 'You: '}
                  {(() => {
                    const shared = parseSharedItem(chat.last_message.content);
                    return shared ? `📌 Shared a ${shared.type}: ${shared.title}` : chat.last_message.content;
                  })()}
                </>
              ) : (
                'No messages yet'
              )}
            </p>
          </div>
        </button>
      );
    });
  };

  const renderChatArea = () => {
    if (!selectedId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose from your existing conversations or team chats</p>
          </div>
        </div>
      );
    }

    if (chatType === 'group' && selectedGroupChat) {
      return (
        <GroupChatThread 
          groupChatId={selectedGroupChat.id} 
          groupName={selectedGroupChat.name} 
        />
      );
    }

    // DM chat
    return (
      <>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg) => {
              const sharedItem = parseSharedItem(msg.content);
              const isOwn = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl',
                      sharedItem ? 'p-1' : 'px-4 py-2',
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {sharedItem ? (
                      <SharedItemCard data={sharedItem} isOwn={isOwn} />
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    <p className={cn(
                      'text-xs mt-1',
                      sharedItem ? 'px-3 pb-1' : '',
                      isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

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
    );
  };

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
          {renderHeader()}
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
              {renderChatList()}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {renderChatArea()}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden flex-1 flex flex-col">
          {showMobileChat && selectedId ? (
            chatType === 'group' && selectedGroupChat ? (
              <GroupChatThread 
                groupChatId={selectedGroupChat.id} 
                groupName={selectedGroupChat.name} 
              />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const sharedItem = parseSharedItem(msg.content);
                      const isOwn = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            isOwn ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-2xl',
                              sharedItem ? 'p-1' : 'px-4 py-2',
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            {sharedItem ? (
                              <SharedItemCard data={sharedItem} isOwn={isOwn} />
                            ) : (
                              <p className="text-sm">{msg.content}</p>
                            )}
                            <p className={cn(
                              'text-xs mt-1',
                              sharedItem ? 'px-3 pb-1' : '',
                              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

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
            )
          ) : (
            <div className="flex-1 overflow-y-auto pb-20">
              {renderChatList()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
