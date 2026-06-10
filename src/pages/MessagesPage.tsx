import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Send, Loader2, Users, Minimize2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useGroupChats } from '@/hooks/useGroupChats';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import GroupChatThread from '@/components/messages/GroupChatThread';
import NewGroupMessageDialog from '@/components/messages/NewGroupMessageDialog';
import SharedItemCard, { parseSharedItem } from '@/components/messages/SharedItemCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMinimizedChat } from '@/hooks/useMinimizedChat';

type ChatType = 'dm' | 'group';

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: routeUserId, projectId: routeProjectId } = useParams<{ userId?: string; projectId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { minimize } = useMinimizedChat();

  // Read origin route from navigation state
  const originRoute = (location.state as any)?.originRoute as string | undefined;

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [chatType, setChatType] = useState<ChatType>('dm');
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
  
  const existingConversation = conversations.find(c => c.user_id === selectedId);
  const selectedGroupChat = groupChats.find(gc => gc.id === selectedId);
  
  // Fetch profile for new DM conversations not in list yet
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

  const selectedConversation = existingConversation || (newUserProfile ? {
    user_id: newUserProfile.user_id,
    display_name: newUserProfile.display_name,
    avatar_url: newUserProfile.avatar_url,
    unread_count: 0,
  } : null);

  // Check connection status for selected DM partner
  const { data: isConnectedToPartner } = useQuery({
    queryKey: ['dm-connection-check', user?.id, selectedId],
    queryFn: async () => {
      if (!user?.id || !selectedId) return false;
      const { data } = await supabase
        .rpc('get_mutual_connections', { target_user_id: user.id });
      return data?.some((m: { user_id: string }) => m.user_id === selectedId) || false;
    },
    enabled: !!user?.id && !!selectedId && chatType === 'dm',
  });

  // Handle route params for auto-opening conversations
  useEffect(() => {
    if (routeUserId) {
      setChatType('dm');
      setSelectedId(routeUserId);
    }
  }, [routeUserId]);

  useEffect(() => {
    if (routeProjectId && groupChats.length > 0) {
      const gc = groupChats.find(g => g.project_id === routeProjectId);
      if (gc) {
        setChatType('group');
        setSelectedId(gc.id);
      }
    }
  }, [routeProjectId, groupChats]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // If no route params, show empty state
  useEffect(() => {
    if (!routeUserId && !routeProjectId && !authLoading && user) {
      // No specific conversation requested - show empty state
    }
  }, [routeUserId, routeProjectId, authLoading, user]);

  // Mark messages as read
  useEffect(() => {
    if (chatType === 'dm' && selectedId && existingConversation?.unread_count) {
      markAsRead.mutate(selectedId);
    }
  }, [selectedId, existingConversation?.unread_count, chatType]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedId || chatType !== 'dm') return;
    await sendMessage.mutateAsync({ receiverId: selectedId, content: messageText.trim() });
    setMessageText('');
  };

  const handleMinimize = () => {
    if (originRoute) {
      const currentChatRoute = routeUserId 
        ? `/messages/direct/${routeUserId}` 
        : routeProjectId 
        ? `/messages/group/${routeProjectId}` 
        : '/messages';
      minimize(originRoute, currentChatRoute);
      navigate(originRoute);
    } else {
      navigate(-1);
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffHours < 168) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const canSendDm = chatType === 'dm' ? (isConnectedToPartner !== false) : true;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No conversation selected - empty state
  if (!selectedId && !routeUserId && !routeProjectId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">Messages</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
          {loadingConversations || loadingGroupChats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 && groupChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm">Open a chat from a profile or project page</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto py-2">
              {groupChats.map((gc) => (
                <button
                  key={`g-${gc.id}`}
                  onClick={() => navigate(`/messages/group/${gc.project_id}`)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left border-b border-border"
                >
                  <Avatar className="w-12 h-12 bg-primary/10">
                    <AvatarFallback className="bg-primary/10">
                      <Users className="w-5 h-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{gc.name}</p>
                    <p className="text-xs text-muted-foreground">Team chat</p>
                  </div>
                </button>
              ))}
              {conversations.map((c) => (
                <button
                  key={`d-${c.user_id}`}
                  onClick={() => navigate(`/messages/direct/${c.user_id}`)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left border-b border-border"
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={c.avatar_url || undefined} />
                      <AvatarFallback>{c.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    {c.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-medium truncate', c.unread_count > 0 && 'font-semibold')}>
                        {c.display_name || 'Unknown'}
                      </span>
                      {c.last_message && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(c.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    {c.last_message && (
                      <p className={cn(
                        'text-sm truncate',
                        c.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {c.last_message.sender_id === user?.id && 'You: '}
                        {c.last_message.content}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render header based on chat type
  const renderHeader = () => {
    if (chatType === 'group' && selectedGroupChat) {
      return (
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="w-10 h-10 bg-primary/10">
            <AvatarFallback className="bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-semibold">{selectedGroupChat.name}</h1>
            <p className="text-xs text-muted-foreground">Team Chat</p>
          </div>
          <NewGroupMessageDialog 
            groupChatId={selectedGroupChat.id} 
            projectId={selectedGroupChat.project_id} 
          />
          <Button variant="ghost" size="icon" onClick={handleMinimize}>
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>
      );
    } else if (chatType === 'dm' && selectedConversation) {
      return (
        <div className="flex items-center gap-3 flex-1">
          <Avatar 
            className="w-10 h-10 cursor-pointer" 
            onClick={() => navigate(`/profile/${selectedId}`)}
          >
            <AvatarImage src={selectedConversation.avatar_url || undefined} />
            <AvatarFallback>{selectedConversation.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${selectedId}`)}
            >
              {selectedConversation.display_name || 'Unknown'}
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleMinimize}>
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>
      );
    }
    return <h1 className="text-2xl font-display font-bold">Messages</h1>;
  };

  const renderChatArea = () => {
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
      <div className="flex-1 flex flex-col">
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
                  className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl',
                      sharedItem ? 'p-1' : 'px-4 py-2',
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
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

        {/* Send input - disabled if not connected */}
        <div className="p-4 border-t border-border">
          {canSendDm ? (
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              You are no longer connected with this person
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => originRoute ? navigate(originRoute) : navigate(-1)}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {renderHeader()}
        </div>
      </header>

      {/* Chat Area - no sidebar, context-filtered */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderChatArea()}
      </div>
    </div>
  );
};

export default MessagesPage;
