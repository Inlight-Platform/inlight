const CURRENT_SUPABASE_URL = 'https://piofmmawwnermvaysonw.supabase.co';
const CURRENT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Np7ZYBlXrk0bOtzAGzYW5g_Rfr0xubM';

const RETIRED_SUPABASE_HOSTS = new Set([
  'gbiostpdhvfxpppfqskw.supabase.co',
]);

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const normalizeUrl = (value: string | undefined) => value?.replace(/\/+$/, '');

const isRetiredSupabaseUrl = (value: string | undefined) => {
  if (!value) return false;

  try {
    return RETIRED_SUPABASE_HOSTS.has(new URL(value).host);
  } catch {
    return false;
  }
};

export const SUPABASE_URL = isRetiredSupabaseUrl(envSupabaseUrl)
  ? CURRENT_SUPABASE_URL
  : normalizeUrl(envSupabaseUrl) || CURRENT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY = isRetiredSupabaseUrl(envSupabaseUrl)
  ? CURRENT_SUPABASE_PUBLISHABLE_KEY
  : envPublishableKey || CURRENT_SUPABASE_PUBLISHABLE_KEY;
