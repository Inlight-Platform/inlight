const LOCKED_SUPABASE_URL = 'https://piofmmawwnermvaysonw.supabase.co';
const LOCKED_SUPABASE_HOST = 'piofmmawwnermvaysonw.supabase.co';
const LOCKED_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Np7ZYBlXrk0bOtzAGzYW5g_Rfr0xubM';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const envSupabaseMode = import.meta.env.VITE_SUPABASE_ENV;
const envAllowRemoteSandbox = import.meta.env.VITE_SUPABASE_ALLOW_REMOTE_SANDBOX;
const isSandboxMode = envSupabaseMode === 'sandbox' || import.meta.env.MODE === 'sandbox';

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

const isLocalSupabaseHost = (host: string | undefined) =>
  host === '127.0.0.1:54321' || host === 'localhost:54321';

const isRemoteSandboxAllowed = envAllowRemoteSandbox === 'true';

const resolveLockedSupabaseUrl = (value: string | undefined) => {
  const normalized = normalizeUrl(value);
  const host = getSupabaseHost(normalized);

  if (isSandboxMode) {
    if (!normalized) {
      throw new Error('Sandbox mode requires VITE_SUPABASE_URL.');
    }

    if (host === LOCKED_SUPABASE_HOST) {
      throw new Error('Sandbox mode cannot point at the locked production Supabase project.');
    }

    if (!isLocalSupabaseHost(host) && !isRemoteSandboxAllowed) {
      throw new Error(
        'Sandbox mode only accepts local Supabase unless VITE_SUPABASE_ALLOW_REMOTE_SANDBOX=true is set for hosted PR previews.',
      );
    }

    return normalized;
  }

  if (normalized && host !== LOCKED_SUPABASE_HOST) {
    console.warn(
      `Ignoring VITE_SUPABASE_URL="${normalized}". Inlight is locked to ${LOCKED_SUPABASE_URL}.`,
    );
  }

  return LOCKED_SUPABASE_URL;
};

export const SUPABASE_URL = resolveLockedSupabaseUrl(envSupabaseUrl);

export const SUPABASE_PUBLISHABLE_KEY = isSandboxMode
  ? envPublishableKey
  : envPublishableKey || LOCKED_SUPABASE_PUBLISHABLE_KEY;

if (isSandboxMode && !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Sandbox mode requires VITE_SUPABASE_PUBLISHABLE_KEY from the local Supabase stack.');
}
