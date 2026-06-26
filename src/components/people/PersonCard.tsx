import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Clock, Check, ExternalLink, MapPin, GraduationCap } from 'lucide-react';
import { cn, capitalizeName } from '@/lib/utils';

interface PersonCardProps {
  user: {
    id?: string;
    user_id?: string;
    display_name?: string;
    name?: string;
    avatar_url?: string;
    avatar?: string;
    role?: string;
    bio?: string;
    badges?: string[];
    skills?: string[];
    graduation_year?: number;
  };
  connectionStatus?: 'none' | 'pending' | 'connected';
  showCancelButton?: boolean;
  showIncomingActions?: boolean;
  requestId?: string;
  isOwnProfile?: boolean;
  onConnect?: (userId: string) => void;
  onCancel?: (requestId: string) => void;
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onMessage?: () => void;
}

const PersonCard: React.FC<PersonCardProps> = ({
  user,
  connectionStatus = 'none',
  showCancelButton = false,
  showIncomingActions = false,
  requestId,
  isOwnProfile = false,
  onConnect,
  onCancel,
  onAccept,
  onDecline,
  onMessage
}) => {
  const navigate = useNavigate();
  const userId = user.user_id || user.id;
  const displayName = capitalizeName(user.display_name || user.name || 'Unknown User');
  const avatarUrl = user.avatar_url || user.avatar;

  const handleClick = () => {
    if (userId) navigate(`/profile/${userId}`, { state: { returnTo: '/people' } });
  };

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId && onConnect) onConnect(userId);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requestId && onCancel) onCancel(requestId);
  };

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requestId && onAccept) onAccept(requestId);
  };

  const handleDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requestId && onDecline) onDecline(requestId);
  };

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId) navigate(`/messages/direct/${userId}`, { state: { originRoute: window.location.pathname } });
  };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={handleClick}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/12 via-primary/6 to-transparent" />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-16 w-16 border border-border shadow-sm ring-2 ring-background">
            <AvatarImage src={avatarUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-muted text-lg">
              {displayName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold text-foreground">
                  {displayName}
                </h3>
                {user.role ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {user.role}
                  </p>
                ) : null}
              </div>

              {user.graduation_year ? (
                <Badge variant="secondary" className="shrink-0 gap-1 rounded-full px-2 py-1 text-[10px]">
                  <GraduationCap className="h-3 w-3" />
                  {String(user.graduation_year).slice(-2)}
                </Badge>
              ) : null}
            </div>

            {user.badges && user.badges.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.badges.slice(0, 2).map((badge) => (
                  <Badge key={badge} variant="outline" className="max-w-full rounded-full text-[10px]">
                    <span className="truncate">#{badge}</span>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {user.bio ? (
          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {user.bio}
          </p>
        ) : null}

        {(user.skills && user.skills.length > 0) || user.role ? (
          <div className="mt-4 flex min-h-7 flex-wrap gap-1.5">
            {user.skills?.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {skill}
              </span>
            ))}
            {user.skills && user.skills.length > 3 ? (
              <span className="rounded-full px-1.5 py-1 text-[11px] text-muted-foreground">
                +{user.skills.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        {!isOwnProfile ? (
          <div className="mt-5 flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <>
                <Button
                  variant="outline"
                  className="h-10 flex-1 gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
                  onClick={handleMessage}
                >
                  <Check className="h-4 w-4" />
                  Connected
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={handleMessage}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </>
            ) : null}

            {connectionStatus === 'pending' && !showCancelButton ? (
              <Button
                variant="outline"
                className="h-10 flex-1 gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400"
                disabled
              >
                <Clock className="h-4 w-4" />
                Pending
              </Button>
            ) : null}

            {showCancelButton && requestId ? (
              <Button
                variant="outline"
                className="h-10 flex-1 gap-2 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                onClick={handleCancel}
              >
                <Clock className="h-4 w-4" />
                Cancel Request
              </Button>
            ) : null}

            {showIncomingActions && requestId ? (
              <div className="flex w-full gap-2">
                <Button className="h-10 flex-1 gap-1.5" onClick={handleAccept}>
                  <Check className="h-4 w-4" />
                  Accept
                </Button>
                <Button variant="outline" className="h-10 flex-1" onClick={handleDecline}>
                  Decline
                </Button>
              </div>
            ) : null}

            {connectionStatus === 'none' && !showCancelButton && !showIncomingActions ? (
              <>
                <Button className="h-10 flex-1 gap-2" onClick={handleConnect}>
                  <Users className="h-4 w-4" />
                  Connect
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (userId) navigate(`/profile/${userId}`, { state: { returnTo: '/people' } });
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

};

export default PersonCard;
