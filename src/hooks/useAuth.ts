import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');

      if (code && (type === 'recovery' || url.searchParams.get('mode') === 'reset')) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error('Password recovery code exchange failed:', error);
          setRecoveryError(error.message);
          setLoading(false);
          return;
        }

        setIsPasswordRecovery(true);
        setSession(data.session);
        setUser(data.user);
        window.history.replaceState({}, document.title, '/auth?mode=reset');
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
    const allowedEmails = ['info@inlight.social', 'alabfestival@gmail.com'];
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
