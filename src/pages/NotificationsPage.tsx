import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, Mail, FileText, UserPlus, Check, Trash2, Users, X, Link2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { useMessages } from '@/hooks/useMessages';
import { useGroupChats } from '@/hooks/useGroupChats';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';
import GroupChatItem from '@/components/messages/GroupChatItem';
import { parseSharedItem } from '@/components/messages/SharedItemCard';
import { Badge } from '@/components/ui/badge';

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';
  const { user } = useAuth();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const { follow, isFollowing, isFollowPending } = useNetworkConnections();
  const { acceptRequest, rejectRequest } = useConnectionRequests();
  const { conversations, loadingConversations, totalUnread } = useMessages();
  const { groupChats, loadingGroupChats } = useGroupChats();

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <Mail className="w-4 h-4" />;
      case 'application': return <FileText className="w-4 h-4" />;
      case 'invitation': return <UserPlus className="w-4 h-4" />;
      case 'follow': return <Users className="w-4 h-4" />;
      case 'connection_request': return <Link2 className="w-4 h-4" />;
      case 'connection_request_accepted': return <Check className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const handleAcceptRequest = (e: React.MouseEvent, requestId: string, notificationId: string) => {
    e.stopPropagation();
    acceptRequest.mutate(requestId, {
      onSuccess: () => { markAsRead.mutate(notificationId); toast.success('Connection accepted!'); },
      onError: () => { toast.error('Failed to accept connection'); },
    });
  };

  const handleRejectRequest = (e: React.MouseEvent, requestId: string, notificationId: string) => {
    e.stopPropagation();
    rejectRequest.mutate(requestId, {
      onSuccess: () => { deleteNotification.mutate(notificationId); toast.success('Connection declined'); },
      onError: () => { toast.error('Failed to decline connection'); },
    });
  };

  const handleFollowBack = (e: React.MouseEvent, followerId: string, notificationId: string) => {
    e.stopPropagation();
    follow(followerId);
    markAsRead.mutate(notificationId);
    toast.success('Following back!');
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read_at) markAsRead.mutate(notification.id);
    const data = notification.data as Record<string, string>;
    switch (notification.type) {
      case 'message': navigate(`/messages?user=${data.sender_id}`); break;
      case 'application':
        if (data.project_id) navigate(`/projects/${data.project_id}?application=${data.application_id || ''}`);
        else navigate('/projects');
        break;
      case 'invitation': navigate('/projects'); break;
      case 'follow': if (data.follower_id) navigate(`/profile/${data.follower_id}`); break;
      case 'connection_request': if (data.sender_id) navigate(`/profile/${data.sender_id}`); break;
      case 'connection_request_accepted': if (data.user_id) navigate(`/profile/${data.user_id}`); break;
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

  // Combine and sort all chats
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

  const handleNewMessage = (userId: string) => {
    navigate(`/messages?user=${userId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-display font-bold">Notifications</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        <Tabs defaultValue={initialTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1 gap-2">
              All
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-1 gap-2">
              Messages
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 min-w-[20px]">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ALL NOTIFICATIONS TAB */}
          <TabsContent value="all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{notifications.length} notifications</span>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markAllAsRead.mutate()} className="text-xs">
                  <Check className="w-3 h-3 mr-1" /> Mark all read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 hover:bg-accent transition-colors cursor-pointer group',
                      !notification.read_at && 'bg-accent/50'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-full',
                        !notification.read_at ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !notification.read_at && 'font-medium')}>
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                        {notification.type === 'follow' && (() => {
                          const data = notification.data as Record<string, string>;
                          const followerId = data?.follower_id;
                          if (followerId && !isFollowing(followerId)) {
                            return (
                              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs"
                                onClick={(e) => handleFollowBack(e, followerId, notification.id)}
                                disabled={isFollowPending}>
                                <UserPlus className="w-3 h-3 mr-1" /> Follow Back
                              </Button>
                            );
                          }
                          return null;
                        })()}
                        {notification.type === 'connection_request' && !notification.read_at && (() => {
                          const data = notification.data as Record<string, string>;
                          const requestId = data?.request_id;
                          if (requestId) {
                            return (
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="default" className="h-7 text-xs"
                                  onClick={(e) => handleAcceptRequest(e, requestId, notification.id)}
                                  disabled={acceptRequest.isPending}>
                                  <Check className="w-3 h-3 mr-1" /> Accept
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={(e) => handleRejectRequest(e, requestId, notification.id)}
                                  disabled={rejectRequest.isPending}>
                                  <X className="w-3 h-3 mr-1" /> Decline
                                </Button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(notification.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* MESSAGES TAB */}
          <TabsContent value="messages">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{allChats.length} conversations</span>
              <NewMessageDialog onSelectUser={handleNewMessage} />
            </div>

            {(loadingConversations || loadingGroupChats) ? (
              <div className="py-16 text-center text-muted-foreground">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : allChats.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a conversation with someone in your network</p>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {allChats.map(chat => {
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
                        isSelected={false}
                        onClick={() => navigate(`/messages?group=${chat.id}`)}
                      />
                    );
                  }

                  return (
                    <button
                      key={`dm-${chat.id}`}
                      onClick={() => navigate(`/messages?user=${chat.id}`)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
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
                          <span className={cn('font-medium truncate', chat.unread_count > 0 && 'font-semibold')}>
                            {chat.name}
                          </span>
                          {chat.last_message && (
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                              {formatTime(chat.last_message.created_at)}
                            </span>
                          )}
                        </div>
                        <p className={cn('text-sm truncate', chat.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                          {chat.last_message ? (
                            <>
                              {chat.last_message.sender_id === user?.id && 'You: '}
                              {(() => {
                                const shared = parseSharedItem(chat.last_message.content);
                                return shared ? `📌 Shared a ${shared.type}: ${shared.title}` : chat.last_message.content;
                              })()}
                            </>
                          ) : 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NotificationsPage;
