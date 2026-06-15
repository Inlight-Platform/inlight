import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { isAllowedSignupEmail, signupEmailPolicyMessage } from '@/lib/authPolicy';

export const accountAlreadyExistsMessage =
  'Your account already exists. Try signing in or resetting your password.';

const isExistingSignupResponse = (data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data']) => {
  return Boolean(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
};

type SignupRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SignupRpc = {
  (
    fn: 'is_signup_email_allowed',
    args: { _email: string; _platform_token?: string | null; _credit_token?: string | null }
  ): Promise<SignupRpcResult<boolean>>;
  (
    fn: 'check_email_exists_for_signup',
    args: { search_email: string }
  ): Promise<SignupRpcResult<boolean>>;
};

const signupRpc: SignupRpc = ((fn: string, args: Record<string, unknown>) => {
  return supabase.rpc(fn as never, args as never);
}) as SignupRpc;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const maybeSendShowcaseWelcome = async (activeSession: Session | null) => {
    if (!activeSession?.user) return;

    try {
      const pending = localStorage.getItem('inlight_showcase_welcome_pending');
      const sent = localStorage.getItem('inlight_showcase_welcome_sent');
      const programName = localStorage.getItem('inlight_showcase_program');

      if (pending !== '1' || sent === '1' || !programName) {
        return;
      }

      const { error } = await supabase.functions.invoke('send-showcase-welcome', {
        body: { programName },
      });

      if (error) {
        console.error('Welcome email failed:', error);
        return;
      }

      localStorage.setItem('inlight_showcase_welcome_sent', '1');
      localStorage.removeItem('inlight_showcase_welcome_pending');
    } catch (error) {
      console.error('Welcome email scheduling failed:', error);
    }
  };

  const maybeClaimInvites = async (activeSession: Session | null) => {
    if (!activeSession?.user) return;

    try {
      const platformToken = localStorage.getItem('inlight_platform_invite_token');
      const creditToken = localStorage.getItem('inlight_project_credit_invite_token');

      if (!platformToken && !creditToken) {
        return;
      }

      const { error } = await supabase.rpc('claim_invites_on_signup', {
        _platform_token: platformToken || undefined,
        _credit_token: creditToken || undefined,
      });

      if (error) {
        console.error('Invite claim failed:', error);
        return;
      }

      localStorage.removeItem('inlight_platform_invite_token');
      localStorage.removeItem('inlight_project_credit_invite_token');
    } catch (error) {
      console.error('Invite claim failed:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const type = url.searchParams.get('type');
        const inviteToken = url.searchParams.get('invite');
        const creditInviteToken = url.searchParams.get('credit_invite');
        const isRecoveryFlow = type === 'recovery' || url.searchParams.get('mode') === 'reset';
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        const isHashRecoveryFlow = hashType === 'recovery' || isRecoveryFlow;

        const replaceAuthUrl = (isRecovery: boolean) => {
          window.history.replaceState(
            {},
            document.title,
            isRecovery ? '/auth?mode=reset' : url.pathname || '/'
          );
        };

        if (inviteToken) {
          localStorage.setItem('inlight_platform_invite_token', inviteToken);
        }
        if (creditInviteToken) {
          localStorage.setItem('inlight_project_credit_invite_token', creditInviteToken);
        }

        if (hashAccessToken && hashRefreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });

          if (!isMounted) {
            return;
          }

          if (error) {
            console.error('Auth session setup from URL failed:', error);
            if (isHashRecoveryFlow) {
              setRecoveryError(error.message);
            }
            setLoading(false);
            return;
          }

          if (isHashRecoveryFlow) {
            setIsPasswordRecovery(true);
          }
          setSession(data.session);
          setUser(data.user);
          void maybeClaimInvites(data.session);
          replaceAuthUrl(isHashRecoveryFlow);
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (!isMounted) {
            return;
          }

          if (error) {
            console.error('Auth code exchange failed:', error);
            if (isRecoveryFlow) {
              setRecoveryError(error.message);
            }
            setLoading(false);
            return;
          }

          if (isRecoveryFlow) {
            setIsPasswordRecovery(true);
          }
          setSession(data.session);
          setUser(data.user);
          void maybeClaimInvites(data.session);
          replaceAuthUrl(isRecoveryFlow);
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        void maybeClaimInvites(session);
        setLoading(false);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        if (!isMounted) {
          return;
        }
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event);
        
        // Detect password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          void maybeSendShowcaseWelcome(session);
          void maybeClaimInvites(session);
        }

        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const key = 'inlight-login-count';
            const current = Number(localStorage.getItem(key) ?? '0');
            localStorage.setItem(key, String(current + 1));
          } catch {
            /* ignore storage errors */
          }
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    platformInviteToken?: string | null,
    projectCreditInviteToken?: string | null
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedInviteToken = platformInviteToken?.trim() || null;
    const normalizedCreditInviteToken = projectCreditInviteToken?.trim() || null;

    if (!isAllowedSignupEmail(normalizedEmail)) {
      const { data: isSignupAllowed, error: policyError } = await signupRpc('is_signup_email_allowed', {
        _email: normalizedEmail,
        _platform_token: normalizedInviteToken,
        _credit_token: normalizedCreditInviteToken,
      });

      if (policyError || !isSignupAllowed) {
        return { data: null, error: { message: signupEmailPolicyMessage } };
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName || normalizedEmail.split('@')[0],
          ...(normalizedInviteToken ? { platform_invite_token: normalizedInviteToken } : {}),
          ...(normalizedCreditInviteToken ? { project_credit_invite_token: normalizedCreditInviteToken } : {}),
        },
      },
    });

    if (error) {
      const normalizedMessage = error.message.toLowerCase();
      if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists')) {
        return { data, error: { message: accountAlreadyExistsMessage } };
      }

      return { data, error };
    }

    if (isExistingSignupResponse(data)) {
      return { data, error: { message: accountAlreadyExistsMessage } };
    }

    return { data, error: null };
  };

  const checkEmailExists = async (email: string) => {
    const { data, error } = await signupRpc('check_email_exists_for_signup', {
      search_email: email.trim().toLowerCase(),
    });

    return { exists: Boolean(data), error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    return { data, error };
  };

  const signOut = async () => {
    return supabase.auth.signOut({ scope: 'local' });
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('send-password-reset', {
      body: {
        email: email.trim().toLowerCase(),
      },
    });
    return { data, error };
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  };

  return {
    user,
    session,
    loading,
    isPasswordRecovery,
    recoveryError,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    checkEmailExists,
  };
}
