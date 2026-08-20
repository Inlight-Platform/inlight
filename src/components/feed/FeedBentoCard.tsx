import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  Briefcase,
  FolderKanban,
  MessageCircle,
  Theater,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { FeedItemData } from './FeedItem';

export type BentoSize = 'hero' | 'tall' | 'compact' | 'wide';

interface FeedBentoCardProps {
  item: FeedItemData;
  size: BentoSize;
  onClick: () => void;
}

const typeMeta = (item: FeedItemData) => {
  switch (item.type) {
    case 'project':
      return {
        label: 'Project',
        icon: <FolderKanban className="h-4 w-4" />,
        accent: 'text-blue-300',
        pillClass: 'bg-blue-900 text-white',
      };
    case 'event':
      return {
        label: 'Event',
        icon: <Calendar className="h-4 w-4" />,
        accent: 'text-sky-300',
        pillClass: 'bg-sky-300 text-slate-900',
      };
    case 'job':
      return {
        label: 'Opportunity',
        icon: <Briefcase className="h-4 w-4" />,
        accent: 'text-emerald-300',
        pillClass: 'bg-emerald-400 text-slate-900',
      };
    case 'show':
      return {
        label: 'Show',
        icon: <Theater className="h-4 w-4" />,
        accent: 'text-pink-300',
        pillClass: 'bg-pink-400 text-slate-900',
      };
    case 'open_role':
      return {
        label: 'Open Role',
        icon: <UserPlus className="h-4 w-4" />,
        accent: 'text-amber-300',
        pillClass: 'bg-amber-300 text-slate-900',
      };
    default:
      return {
        label: 'Update',
        icon: <MessageCircle className="h-4 w-4" />,
        accent: 'text-yellow-300',
        pillClass: 'bg-yellow-400 text-slate-900',
      };
  }
};

const labelPillClass =
  'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm';

const sizeClasses: Record<BentoSize, string> = {
  // Mobile stacks cards in one column while preserving each bento shape.
  // Dense row packing only kicks in at sm+ breakpoints.
  hero: 'min-h-[420px] sm:col-span-8 sm:row-span-2',
  tall: 'min-h-[420px] sm:col-span-4 sm:row-span-2',
  compact: 'min-h-[260px] sm:col-span-4 sm:row-span-1 sm:min-h-[220px]',
  wide: 'min-h-[220px] sm:col-span-4 sm:row-span-1',
};

export const FeedBentoCard: React.FC<FeedBentoCardProps> = ({ item, size, onClick }) => {
  const meta = typeMeta(item);
  const hasImage = !!item.image_url;
  const showAnonymous = item.type === 'show' && item.is_anonymous;
  const displayName = showAnonymous ? 'Anonymous' : item.creator_profile?.display_name || 'Unknown';
  const avatarUrl = showAnonymous ? undefined : item.creator_profile?.avatar_url;
  const title =
    item.title ||
    (item.content ? item.content.slice(0, 80) + (item.content.length > 80 ? '…' : '') : 'Untitled');
  const subtitle = item.description || item.content;
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
  const posX = item.image_position_x ?? 50;
  const posY = item.image_position_y ?? 50;
  const zoom = item.image_zoom ?? 1;
  const objectPosition = `${posX}% ${posY}%`;
  const zoomStyle = {
    position: 'absolute' as const,
    left: `${posX * (1 - zoom)}%`,
    top: `${posY * (1 - zoom)}%`,
    right: `${(100 - posX) * (1 - zoom)}%`,
    bottom: `${(100 - posY) * (1 - zoom)}%`,
  };
  const imgFillStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    objectPosition,
  };

  const baseShell =
    'group relative col-span-1 overflow-hidden rounded-3xl cursor-pointer transition-all duration-500 sm:col-span-12';

  /* ---------- HERO: big editorial image card ---------- */
  if (size === 'hero') {
    return (
      <article
        onClick={onClick}
        className={cn(
          baseShell,
          sizeClasses.hero,
          'border border-primary/10 bg-gradient-to-br from-[hsl(222_40%_8%)] to-[hsl(222_45%_5%)] shadow-2xl hover:border-primary/30 hover:shadow-primary/10'
        )}
      >
        {hasImage && (
          <>
            <div style={zoomStyle}>
              <img
                src={item.image_url!}
                alt={title}
                loading="lazy"
                style={{ ...imgFillStyle, opacity: 0.6 }}
                className="grayscale-[20%] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-80"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_45%_5%)] via-[hsl(222_45%_5%)]/60 to-transparent" />
          </>
        )}
        <div className="relative flex h-full flex-col justify-end p-6 sm:p-10">
          <div className="mb-4 flex items-center gap-3">
            <span className={cn(labelPillClass, meta.pillClass)}>{meta.label}</span>
            <span className={cn('text-xs font-semibold', meta.accent)}>{timeAgo}</span>
          </div>
          <h3 className="font-display text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl group-hover:translate-x-1 transition-transform duration-500 line-clamp-3">
            {title}
          </h3>
          {subtitle && subtitle !== title && (
            <p className="mt-4 max-w-xl text-sm text-white/70 line-clamp-2">{subtitle}</p>
          )}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>{displayName[0]}</AvatarFallback>
              </Avatar>
              <p className="text-sm font-bold text-white">{displayName}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-background transition-transform group-hover:scale-110">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </article>
    );
  }

  /* ---------- TALL: light editorial magazine card ---------- */
  if (size === 'tall') {
    const isLight = item.type !== 'event' && item.type !== 'job';
    return (
      <article
        onClick={onClick}
        className={cn(
          baseShell,
          sizeClasses.tall,
          isLight
            ? 'bg-[hsl(45_30%_95%)] text-slate-900 hover:-translate-y-1'
            : 'bg-gradient-to-br from-[hsl(222_40%_10%)] to-[hsl(222_45%_6%)] border border-primary/30 text-white hover:-translate-y-1'
        )}
      >
        <div className="absolute right-6 top-6 z-10">
          <span className={cn(labelPillClass, meta.pillClass)}>{meta.label}</span>
        </div>
        <div className="flex h-full flex-col p-6 sm:p-8">
          {hasImage && (
            <div className="relative mb-6 h-40 overflow-hidden rounded-2xl transition-transform duration-500 group-hover:scale-[0.97]">
              <div style={zoomStyle}>
                <img
                  src={item.image_url!}
                  alt={title}
                  style={imgFillStyle}
                  loading="lazy"
                />
              </div>
            </div>
          )}
          <div className="flex flex-1 flex-col justify-center">
            <h3
              className={cn(
                'font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl line-clamp-4',
                isLight && 'underline decoration-primary decoration-[3px] underline-offset-[6px]'
              )}
            >
              {title}
            </h3>
            {subtitle && subtitle !== title && (
              <p className={cn('mt-3 text-sm leading-relaxed line-clamp-3', isLight ? 'text-slate-600' : 'text-white/70')}>
                {subtitle}
              </p>
            )}
          </div>
          <div
            className={cn(
              'mt-6 flex items-center gap-3 border-t pt-4',
              isLight ? 'border-slate-200' : 'border-white/10'
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>{displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-xs font-bold', isLight ? 'text-slate-900' : 'text-white')}>
                {displayName}
              </p>
              <p className={cn('text-[10px]', isLight ? 'text-slate-500' : 'text-white/50')}>{timeAgo}</p>
            </div>
          </div>
        </div>
      </article>
    );
  }

  /* ---------- COMPACT: dark icon card ---------- */
  if (size === 'compact') {
    return (
      <article
        onClick={onClick}
        className={cn(
          baseShell,
          sizeClasses.compact,
          'border border-border bg-card hover:border-primary/50'
        )}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className={cn(labelPillClass, meta.pillClass, 'mb-2 inline-block')}>
                {meta.label}
              </span>
              <h3 className="font-display text-lg font-black leading-tight tracking-tight text-foreground line-clamp-2">
                {title}
              </h3>
            </div>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground">
              {meta.icon}
            </div>
          </div>
          {hasImage ? (
            <div className="relative mb-3 flex-1 overflow-hidden rounded-xl opacity-80 transition-opacity group-hover:opacity-100">
              <div style={zoomStyle}>
                <img
                  src={item.image_url!}
                  alt={title}
                  style={imgFillStyle}
                  loading="lazy"
                />
              </div>
            </div>
          ) : subtitle ? (
            <p className="mb-3 flex-1 text-sm text-muted-foreground line-clamp-3">{subtitle}</p>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center justify-between text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-[8px]">{displayName[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate font-semibold text-muted-foreground">{displayName}</span>
            </div>
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {timeAgo}
            </span>
          </div>
        </div>
      </article>
    );
  }

  /* ---------- WIDE: horizontal thumb + content ---------- */
  return (
    <article
      onClick={onClick}
      className={cn(
        baseShell,
        sizeClasses.wide,
        'border border-primary/20 bg-gradient-to-br from-[hsl(240_50%_14%)] to-[hsl(222_45%_7%)] text-white hover:scale-[1.01]'
      )}
    >
      <div className="flex h-full flex-col justify-between p-5">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 flex-shrink-0 -rotate-3 overflow-hidden rounded-2xl bg-muted transition-transform duration-500 group-hover:rotate-0">
            {hasImage ? (
              <div style={zoomStyle}>
                <img
                  src={item.image_url!}
                  alt={title}
                  style={imgFillStyle}
                  loading="lazy"
                /></div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-foreground/60">{meta.icon}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className={cn(labelPillClass, meta.pillClass, 'mb-1 inline-block')}>
              {meta.label}
            </span>
            <h3 className="font-display text-lg font-extrabold leading-tight text-white line-clamp-2">
              {title}
            </h3>
            {subtitle && subtitle !== title && (
              <p className="mt-1 text-xs text-white/70 line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-[8px]">{displayName[0]}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-semibold text-white/80">{displayName}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
            {timeAgo}
          </span>
        </div>
      </div>
    </article>
  );
};

/** Cycle through bento sizes to create varied, asymmetric editorial rhythm. */
export const getBentoSize = (index: number): BentoSize => {
  const pattern: BentoSize[] = ['hero', 'tall', 'compact', 'wide', 'compact', 'wide'];
  return pattern[index % pattern.length];
};

export default FeedBentoCard;
