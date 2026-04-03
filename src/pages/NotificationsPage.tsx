import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, Mail, FileText, UserPlus, Check, Trash2, Users, X, Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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

  const { follow, isFollowing, isFollowPending } = useNetworkConnections();
  const { acceptRequest, rejectRequest } = useConnectionRequests();

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
      case 'message': navigate(`/messages/direct/${data.sender_id}`); break;
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-display font-bold">Notifications</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
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
      </div>
    </div>
  );
};

export default NotificationsPage;
