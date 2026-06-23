import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Mail, FileText, UserPlus, Check, Trash2, Users, X, Link2, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { useMessages } from '@/hooks/useMessages';
import { useGroupChats } from '@/hooks/useGroupChats';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

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

  const resolveInvitationProjectPath = async (data: Record<string, string>) => {
    if (data.project_id) return `/projects/${data.project_id}`;
    if (!data.role_id) return '/projects';

    const { data: role } = await supabase
      .from('project_roles')
      .select('project_id')
      .eq('id', data.role_id)
      .maybeSingle();

    return role?.project_id ? `/projects/${role.project_id}` : '/projects';
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.read_at) markAsRead.mutate(notification.id);
    const data = notification.data as Record<string, string>;
    switch (notification.type) {
      case 'message':
        if (data.sender_id) navigate(`/messages/direct/${data.sender_id}`);
        else navigate('/messages');
        break;
      case 'application':
        if (data.project_id) navigate(`/projects/${data.project_id}?application=${data.application_id || ''}`);
        else navigate('/projects');
        break;
      case 'invitation': navigate(await resolveInvitationProjectPath(data)); break;
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-display font-bold">Inbox</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">{unreadCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Messages
              {totalUnread > 0 && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">{totalUnread}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
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

          <TabsContent value="messages">
            {loadingConversations || loadingGroupChats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 && groupChats.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs">Open a chat from a profile or project page</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {groupChats.map((gc) => (
                  <button
                    key={`g-${gc.id}`}
                    onClick={() => navigate(`/messages/group/${gc.project_id}`)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
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
                    className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NotificationsPage;
