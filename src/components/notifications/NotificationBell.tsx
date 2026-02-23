import React from 'react';
import { Bell, Mail, FileText, UserPlus, Check, Trash2, Users, X, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotificationBellProps {
  collapsed?: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ collapsed }) => {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    deleteNotification 
  } = useNotifications();
  const { follow, isFollowing, isFollowPending } = useNetworkConnections();
  const { acceptRequest, rejectRequest } = useConnectionRequests();

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <Mail className="w-4 h-4" />;
      case 'application':
        return <FileText className="w-4 h-4" />;
      case 'invitation':
        return <UserPlus className="w-4 h-4" />;
      case 'follow':
        return <Users className="w-4 h-4" />;
      case 'connection_request':
        return <Link2 className="w-4 h-4" />;
      case 'connection_request_accepted':
        return <Check className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const handleAcceptRequest = (e: React.MouseEvent, requestId: string, notificationId: string) => {
    e.stopPropagation();
    acceptRequest.mutate(requestId, {
      onSuccess: () => {
        markAsRead.mutate(notificationId);
        toast.success('Connection accepted!');
      },
      onError: () => {
        toast.error('Failed to accept connection');
      },
    });
  };

  const handleRejectRequest = (e: React.MouseEvent, requestId: string, notificationId: string) => {
    e.stopPropagation();
    rejectRequest.mutate(requestId, {
      onSuccess: () => {
        deleteNotification.mutate(notificationId);
        toast.success('Connection declined');
      },
      onError: () => {
        toast.error('Failed to decline connection');
      },
    });
  };

  const handleFollowBack = (e: React.MouseEvent, followerId: string, notificationId: string) => {
    e.stopPropagation();
    follow(followerId);
    markAsRead.mutate(notificationId);
    toast.success('Following back!');
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark as read
    if (!notification.read_at) {
      markAsRead.mutate(notification.id);
    }

    // Navigate based on type
    const data = notification.data as Record<string, string>;
    switch (notification.type) {
      case 'message':
        navigate(`/messages?user=${data.sender_id}`);
        break;
      case 'application':
        // Navigate to specific project with application highlighted
        if (data.project_id) {
          navigate(`/projects/${data.project_id}?application=${data.application_id || ''}`);
        } else {
          navigate('/projects');
        }
        break;
      case 'invitation':
        // Navigate to invitations
        navigate('/projects');
        break;
      case 'follow':
        // Navigate to follower's profile
        if (data.follower_id) {
          navigate(`/profile/${data.follower_id}`);
        }
        break;
      case 'connection_request':
        // Navigate to sender's profile
        if (data.sender_id) {
          navigate(`/profile/${data.sender_id}`);
        }
        break;
      case 'connection_request_accepted':
        // Navigate to user's profile
        if (data.user_id) {
          navigate(`/profile/${data.user_id}`);
        }
        break;
      default:
        break;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-3 rounded-xl text-sm font-medium transition-colors relative',
            collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3',
            'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <div className="relative">
            <Bell className="w-5 h-5 flex-shrink-0" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {!collapsed && 'Notifications'}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start" 
        side="right"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsRead.mutate()}
              className="text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={cn(
                    'p-3 hover:bg-accent transition-colors cursor-pointer group',
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
                      <p className={cn(
                        'text-sm',
                        !notification.read_at && 'font-medium'
                      )}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                      {/* Follow back button for follow notifications */}
                      {notification.type === 'follow' && (() => {
                        const data = notification.data as Record<string, string>;
                        const followerId = data?.follower_id;
                        if (followerId && !isFollowing(followerId)) {
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-7 text-xs"
                              onClick={(e) => handleFollowBack(e, followerId, notification.id)}
                              disabled={isFollowPending}
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              Follow Back
                            </Button>
                          );
                        }
                        return null;
                      })()}
                      {/* Accept/Decline buttons for connection requests */}
                      {notification.type === 'connection_request' && !notification.read_at && (() => {
                        const data = notification.data as Record<string, string>;
                        const requestId = data?.request_id;
                        if (requestId) {
                          return (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                onClick={(e) => handleAcceptRequest(e, requestId, notification.id)}
                                disabled={acceptRequest.isPending}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={(e) => handleRejectRequest(e, requestId, notification.id)}
                                disabled={rejectRequest.isPending}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Decline
                              </Button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate(notification.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
