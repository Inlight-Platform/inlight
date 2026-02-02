import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, Mail, Clock, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  requestId?: string;
  onConnect?: (userId: string) => void;
  onCancel?: (requestId: string) => void;
  onMessage?: () => void;
}

const PersonCard: React.FC<PersonCardProps> = ({
  user,
  connectionStatus = 'none',
  showCancelButton = false,
  requestId,
  onConnect,
  onCancel,
  onMessage,
}) => {
  const navigate = useNavigate();
  const userId = user.user_id || user.id;
  const displayName = user.display_name || user.name || 'Unknown User';
  const avatarUrl = user.avatar_url || user.avatar;
  
  const handleClick = () => {
    if (userId) navigate(`/profile/${userId}`);
  };

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId && onConnect) onConnect(userId);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requestId && onCancel) onCancel(requestId);
  };

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMessage) onMessage();
  };

  return (
    <div
      className="group relative bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={handleClick}
    >
      {/* Gradient Header */}
      <div 
        className="h-24 relative"
        style={{
          background: 'linear-gradient(135deg, hsl(220 80% 55%) 0%, hsl(200 90% 50%) 50%, hsl(186 100% 50%) 100%)',
        }}
      >
        {/* Graduation Year Badge */}
        {user.graduation_year && (
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
            Class of {user.graduation_year}
          </div>
        )}
      </div>

      {/* Avatar - Overlapping */}
      <div className="flex justify-center -mt-12 relative z-10">
        <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
          <AvatarImage src={avatarUrl || undefined} className="object-cover" />
          <AvatarFallback className="text-2xl bg-muted">
            {displayName[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-4 text-center">
        {/* Name */}
        <h3 className="font-display font-semibold text-lg truncate">
          {displayName}
        </h3>

        {/* Role */}
        {user.role && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {user.role}
          </p>
        )}

        {/* Badges/Affiliations */}
        {user.badges && user.badges.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {user.badges[0]}
          </p>
        )}

        {/* Bio snippet */}
        {user.bio && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2 px-2">
            {user.bio}
          </p>
        )}

        {/* Skills */}
        {user.skills && user.skills.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {user.skills.slice(0, 3).map((skill, idx) => (
              <span
                key={idx}
                className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20"
              >
                {skill}
              </span>
            ))}
            {user.skills.length > 3 && (
              <span className="text-xs text-muted-foreground px-1">
                +{user.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {/* Connected State */}
          {connectionStatus === 'connected' && (
            <>
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-full bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                onClick={handleMessage}
              >
                <Check className="w-4 h-4 mr-2" />
                Connected
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={handleMessage}
              >
                <Mail className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Pending State */}
          {connectionStatus === 'pending' && !showCancelButton && (
            <>
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-full text-amber-600 dark:text-amber-400 border-amber-500/30"
                disabled
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={handleMessage}
              >
                <Mail className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Cancel Request State */}
          {showCancelButton && requestId && (
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-full text-muted-foreground hover:text-destructive hover:border-destructive/50"
              onClick={handleCancel}
            >
              <Clock className="w-4 h-4 mr-2" />
              Cancel Request
            </Button>
          )}

          {/* Connect State */}
          {connectionStatus === 'none' && !showCancelButton && (
            <>
              <Button
                className="flex-1 h-10 rounded-full bg-gradient-to-r from-[hsl(264,100%,65%)] to-[hsl(280,100%,60%)] text-white hover:opacity-90"
                onClick={handleConnect}
              >
                <Users className="w-4 h-4 mr-2" />
                Connect
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  if (userId) navigate(`/profile/${userId}`);
                }}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonCard;
