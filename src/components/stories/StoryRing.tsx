import React from 'react';
import { cn } from '@/lib/utils';
import { User, Story } from '@/store/useStore';

interface StoryRingProps {
  user: User;
  stories: Story[];
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  currentUserId?: string;
}

export const StoryRing: React.FC<StoryRingProps> = ({
  user,
  stories,
  onClick,
  size = 'md',
  showName = true,
  currentUserId
}) => {
  const hasUnviewedStories = stories.some(
    s => !s.viewedBy.includes(currentUserId || '')
  );
  
  const sizeClasses = {
    sm: { container: 'w-16', avatar: 'w-14 h-14', ring: 'p-0.5' },
    md: { container: 'w-20', avatar: 'w-16 h-16', ring: 'p-[3px]' },
    lg: { container: 'w-24', avatar: 'w-20 h-20', ring: 'p-1' }
  };

  const sizes = sizeClasses[size];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 flex-shrink-0",
        sizes.container
      )}
    >
      <div 
        className={cn(
          "rounded-full",
          sizes.ring,
          hasUnviewedStories 
            ? "bg-gradient-to-tr from-[hsl(330,100%,64%)] via-[hsl(350,100%,70%)] to-[hsl(22,100%,59%)]"
            : "bg-muted"
        )}
      >
        <img
          src={user.avatar}
          alt={user.name}
          className={cn(
            "rounded-full object-cover border-2 border-background",
            sizes.avatar
          )}
        />
      </div>
      {showName && (
        <span className="text-xs text-foreground truncate w-full text-center">
          {user.name.split(' ')[0]}
        </span>
      )}
    </button>
  );
};
