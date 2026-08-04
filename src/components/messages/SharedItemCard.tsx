import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, FolderKanban, Theater, BookOpen, Briefcase, Film, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SharedItemData {
  type: string;
  title: string;
  url?: string;
  image_url?: string;
}

// Prefix used to identify shared item messages
export const SHARED_ITEM_PREFIX = '__SHARED_ITEM__';
export const SHARED_ITEM_SUFFIX = '__END__';

export function parseSharedItem(content: string | null | undefined): SharedItemData | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith(SHARED_ITEM_PREFIX)) return null;
  try {
    const endIdx = trimmed.lastIndexOf(SHARED_ITEM_SUFFIX);
    if (endIdx === -1) return null;
    const jsonStr = trimmed.slice(SHARED_ITEM_PREFIX.length, endIdx);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function buildSharedItemMessage(data: SharedItemData): string {
  return `${SHARED_ITEM_PREFIX}${JSON.stringify(data)}${SHARED_ITEM_SUFFIX}`;
}

const typeIcons: Record<string, React.ElementType> = {
  Project: FolderKanban,
  Show: Theater,
  Resource: BookOpen,
  Job: Briefcase,
  Film: Film,
  Profile: User,
};

interface SharedItemCardProps {
  data: SharedItemData;
  isOwn: boolean;
  onCardClick?: (data: SharedItemData) => void;
}

const SharedItemCard: React.FC<SharedItemCardProps> = ({ data, isOwn, onCardClick }) => {
  const navigate = useNavigate();
  const Icon = typeIcons[data.type] || ExternalLink;

  const handleClick = () => {
    if (!data.url) return;
    // Non-project types with a custom handler: let the parent open an in-place sheet
    if (onCardClick && data.type !== 'Project') {
      onCardClick(data);
      return;
    }
    // Internal links navigate, external links open in new tab
    if (data.url.startsWith('/') || data.url.startsWith(window.location.origin)) {
      const path = data.url.startsWith('http') ? new URL(data.url).pathname : data.url;
      navigate(path);
    } else {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    }
  };

  const hasUrl = !!data.url;

  return (
    <button
      onClick={handleClick}
      className={cn(
        'block w-full text-left rounded-xl overflow-hidden border transition-all',
        hasUrl
          ? cn(
              'hover:shadow-md',
              isOwn
                ? 'border-primary-foreground/20 hover:border-primary-foreground/40'
                : 'border-border hover:border-primary/30'
            )
          : cn(
              'cursor-default',
              isOwn ? 'border-primary-foreground/20' : 'border-border'
            )
      )}
    >
      {data.image_url && (
        <img
          src={data.image_url}
          alt={data.title}
          className="w-full h-32 object-cover"
        />
      )}
      <div className={cn(
        'p-3 flex items-center gap-2',
        isOwn ? 'bg-primary-foreground/10' : 'bg-accent/50'
      )}>
        <Icon className={cn(
          'w-4 h-4 shrink-0',
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )} />
        <div className="min-w-0 flex-1">
          <p className={cn(
            'text-sm font-medium truncate',
            isOwn ? 'text-primary-foreground' : 'text-foreground'
          )}>
            {data.title}
          </p>
          <p className={cn(
            'text-xs',
            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
          )}>
            {hasUrl ? `${data.type} · Tap to view` : data.type}
          </p>
        </div>
      </div>
    </button>
  );
};

export default SharedItemCard;
