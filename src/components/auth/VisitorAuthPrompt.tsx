import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthSegmentedButton } from '@/components/auth/AuthSegmentedButton';
import { AuthRestoreState } from '@/lib/authRestore';

interface VisitorAuthPromptProps {
  title: string;
  description: string;
  features?: string[];
  className?: string;
  compact?: boolean;
  restore?: AuthRestoreState;
}

interface VisitorAuthOverlayProps extends VisitorAuthPromptProps {
  children: React.ReactNode;
}

export const VisitorAuthPrompt: React.FC<VisitorAuthPromptProps> = ({
  title,
  description,
  features = [],
  className,
  compact = false,
  restore,
}) => {
  return (
    <div
      className={cn(
        'mx-auto w-full overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-soft backdrop-blur',
        compact ? 'max-w-md p-4' : 'max-w-2xl p-5 sm:p-6',
        className
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={cn('flex gap-4', compact ? 'items-start' : 'items-start sm:items-center')}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Sign in to unlock</p>
            <h2 className={cn('font-display font-semibold text-foreground', compact ? 'text-xl' : 'text-2xl')}>
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          {features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}

          <AuthSegmentedButton size={compact ? 'md' : 'lg'} fullWidth className="max-w-sm" restore={restore} />
        </div>
      </div>
    </div>
  );
};

export const VisitorAuthOverlay: React.FC<VisitorAuthOverlayProps> = ({
  children,
  className,
  ...promptProps
}) => (
  <div className={cn('relative min-h-[360px]', className)}>
    {children}
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-background/45 px-4 py-8 backdrop-blur-md sm:px-6">
      <VisitorAuthPrompt {...promptProps} />
    </div>
  </div>
);
