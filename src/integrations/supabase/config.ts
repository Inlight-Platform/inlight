const LOCKED_SUPABASE_URL = 'https://piofmmawwnermvaysonw.supabase.co';
const LOCKED_SUPABASE_HOST = 'piofmmawwnermvaysonw.supabase.co';
const LOCKED_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Np7ZYBlXrk0bOtzAGzYW5g_Rfr0xubM';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const normalizeUrl = (value: string | undefined) => value?.replace(/\/+$/, '');

const getSupabaseHost = (value: string | undefined) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return undefined;

  try {
    return new URL(normalized).host;
  } catch {
    return undefined;
  }
};

const resolveLockedSupabaseUrl = (value: string | undefined) => {
  const normalized = normalizeUrl(value);
  const host = getSupabaseHost(normalized);

  if (normalized && host !== LOCKED_SUPABASE_HOST) {
    console.warn(
      `Ignoring VITE_SUPABASE_URL="${normalized}". Inlight is locked to ${LOCKED_SUPABASE_URL}.`,
    );
  }

  return LOCKED_SUPABASE_URL;
};

export const SUPABASE_URL = resolveLockedSupabaseUrl(envSupabaseUrl);

export const SUPABASE_PUBLISHABLE_KEY = envPublishableKey || LOCKED_SUPABASE_PUBLISHABLE_KEY;
