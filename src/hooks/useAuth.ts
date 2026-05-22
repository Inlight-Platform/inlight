import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

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

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');
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
        replaceAuthUrl(isRecoveryFlow);
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    // Validate nyu.edu email (admin/whitelisted emails bypass this check)
    const allowedEmails = ['info@inlight.social', 'alabfestival@gmail.com', 'clelyfdes@gmail.com', 'clelyfernandes19@gmail.com'];
    if (!email.toLowerCase().endsWith('@nyu.edu') && !allowedEmails.includes(email.toLowerCase())) {
      return { error: { message: 'Only nyu.edu email addresses are allowed to sign up.' } };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('send-password-reset', {
      body: {
        email,
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
  };
}
