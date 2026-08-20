import type { User } from '@supabase/supabase-js';

export const emailNotConfirmedMessage =
  'Please confirm your email before signing in. Check your inbox for the verification link.';

export const isUserEmailConfirmed = (user: User | null | undefined) => {
  if (!user) return false;

  return Boolean(user.email_confirmed_at || user.confirmed_at);
};
