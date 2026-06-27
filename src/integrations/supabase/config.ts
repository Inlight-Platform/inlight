const CURRENT_SUPABASE_URL = 'https://gbiostpdhvfxpppfqskw.supabase.co';
const CURRENT_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiaW9zdHBkaHZmeHBwcGZxc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzk5MzIsImV4cCI6MjA4MzY1NTkzMn0.JnNtO8ai56DAOPPxXbIcGYbWY1i4AB7xgqxdJprs_FA';

const RETIRED_SUPABASE_HOSTS = new Set([
  'piofmmawwnermvaysonw.supabase.co',
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
