import React from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AuthRestoreState, saveAuthRestore, saveAuthReturnTo } from '@/lib/authRestore';

interface AuthSegmentedButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  showIcons?: boolean;
  restore?: AuthRestoreState;
}

const sizeClasses = {
  sm: {
    wrapper: 'h-9 text-[10px] tracking-[0.12em] sm:text-[11px] sm:tracking-[0.14em]',
    button: 'px-3 sm:px-3.5',
    icon: 'h-3.5 w-3.5',
  },
  md: {
    wrapper: 'h-11 text-xs tracking-[0.08em]',
    button: 'px-4',
    icon: 'h-4 w-4',
  },
  lg: {
    wrapper: 'h-12 text-sm tracking-[0.03em]',
    button: 'px-5',
    icon: 'h-4 w-4',
  },
};

export const AuthSegmentedButton: React.FC<AuthSegmentedButtonProps> = ({
  className,
  size = 'md',
  fullWidth = false,
  showIcons = false,
  restore,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const styles = sizeClasses[size];

  const goToAuth = (mode: 'signin' | 'signup') => {
    const returnParams = new URLSearchParams(location.search);
    if (restore?.type === 'opportunity') {
      returnParams.set('job', restore.id);
    }

    const returnSearch = returnParams.toString();
    const returnTo = `${location.pathname}${returnSearch ? `?${returnSearch}` : ''}${location.hash}`;
    saveAuthRestore(restore);
    saveAuthReturnTo(returnTo);
    const authParams = new URLSearchParams();
    if (mode === 'signup') authParams.set('mode', 'signup');
    authParams.set('returnTo', returnTo);
    if (restore?.type === 'opportunity') authParams.set('restoreOpportunityId', restore.id);

    navigate(`/auth?${authParams.toString()}`, {
      state: {
        from: {
          ...location,
          search: returnSearch ? `?${returnSearch}` : '',
        },
        restore,
      },
    });
  };

  return (
    <div
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-full border border-border/70 bg-background/55 p-0.5 text-muted-foreground shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl',
        'dark:border-white/10 dark:bg-white/[0.035] dark:text-white/68 dark:shadow-[0_12px_34px_rgba(0,0,0,0.22)]',
        styles.wrapper,
        fullWidth ? 'w-full' : 'w-fit',
        className,
      )}
      aria-label="Sign in or sign up"
    >
      <button
        type="button"
        className={cn(
          'inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full font-medium transition hover:bg-foreground/[0.045] hover:text-foreground',
          'dark:hover:bg-white/[0.07] dark:hover:text-white',
          styles.button,
        )}
        onClick={() => goToAuth('signin')}
      >
        {showIcons && <LogIn className={styles.icon} />}
        <span className="whitespace-nowrap">Sign in</span>
      </button>
      <button
        type="button"
        className={cn(
          'inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full bg-foreground/[0.075] font-semibold text-foreground transition hover:bg-foreground/[0.12]',
          'dark:bg-white/[0.105] dark:text-white/92 dark:hover:bg-white/[0.16]',
          styles.button,
        )}
        onClick={() => goToAuth('signup')}
      >
        {showIcons && <UserPlus className={styles.icon} />}
        <span className="whitespace-nowrap">Sign up</span>
      </button>
    </div>
  );
};
