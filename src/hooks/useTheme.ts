import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'inlight-theme';
const EVENT = 'inlight-theme-change';

const apply = (theme: Theme) => {
  const html = document.documentElement;
  html.classList.toggle('dark', theme === 'dark');
  html.classList.toggle('light', theme === 'light');
  html.style.colorScheme = theme;
};

export const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
};

// Initialise immediately on module load so the first render matches storage.
if (typeof window !== 'undefined') {
  apply(getStoredTheme());
}

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const handler = () => setThemeState(getStoredTheme());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    setThemeState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark', isLight: theme === 'light' };
};

/**
 * Force a specific theme for the lifetime of the calling component
 * (used on Landing / Preview pages so they always render in their
 * designed dark aesthetic regardless of user preference).
 * Restores the user's stored preference on unmount.
 */
export const useForceTheme = (forced: Theme) => {
  useEffect(() => {
    apply(forced);
    return () => apply(getStoredTheme());
  }, [forced]);
};