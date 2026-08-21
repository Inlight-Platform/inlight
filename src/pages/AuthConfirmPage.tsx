import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { Sparkle } from '@/components/Sparkle';
import { Starfield } from '@/components/Starfield';
import { useForceTheme } from '@/hooks/useTheme';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type ConfirmState = 'loading' | 'success' | 'error';

const allowedOtpTypes: EmailOtpType[] = ['signup', 'email'];

const AuthConfirmPage: React.FC = () => {
  useForceTheme('dark');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ConfirmState>('loading');
  const [message, setMessage] = useState('Confirming your account...');

  const tokenHash = searchParams.get('token_hash') || '';
  const otpType = useMemo<EmailOtpType>(() => {
    const rawType = searchParams.get('type');
    return allowedOtpTypes.includes(rawType as EmailOtpType) ? (rawType as EmailOtpType) : 'signup';
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const confirmEmail = async () => {
      if (!tokenHash) {
        setState('error');
        setMessage('This confirmation link is missing a verification token.');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });

      if (!isMounted) return;

      if (error) {
        setState('error');
        setMessage(error.message || 'This confirmation link is invalid or expired.');
        return;
      }

      setState('success');
      setMessage('Your email is verified. Taking you to Inlight...');
      window.setTimeout(() => {
        navigate('/feed', { replace: true });
      }, 1200);
    };

    void confirmEmail();

    return () => {
      isMounted = false;
    };
  }, [navigate, otpType, tokenHash]);

  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const Icon = isLoading ? Loader2 : isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <main className="dark relative min-h-screen overflow-hidden bg-night text-foreground">
      <div className="fixed inset-0 -z-10 bg-night">
        <div className="absolute inset-0 bg-aurora opacity-70" />
        <Starfield density={110} />
      </div>

      <nav className="fixed inset-x-0 top-0 z-50 px-6 py-5 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-2">
          <img src={inlightLogo} alt="Inlight" className="h-8 w-8 rounded-full object-cover" />
        </Link>
      </nav>

      <section className="relative flex min-h-screen items-center justify-center px-6 py-28">
        <div className="relative w-full max-w-md text-center">
          <div className="mb-8 flex justify-center gap-2 text-glow">
            <Sparkle size={16} className="opacity-60" />
            <Sparkle size={24} />
            <Sparkle size={12} className="opacity-40" />
          </div>
          <div className="mb-5 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            Email confirmation
          </div>
          <h1 className="font-editorial text-5xl leading-[1.05] tracking-tight text-white sm:text-7xl">
            Verify your <em className="font-normal italic text-accent-blue">account</em>.
          </h1>

          <div className="mt-10 rounded-3xl border border-border bg-card/60 p-6 text-left shadow-soft backdrop-blur-xl sm:p-8">
            <Alert className={isSuccess ? 'border-glow/40 bg-glow/10 text-white' : 'border-border bg-secondary/30 text-white'}>
              <Icon className={isLoading ? 'h-5 w-5 animate-spin text-glow' : isSuccess ? 'h-5 w-5 text-glow' : 'h-5 w-5'} />
              <AlertTitle>{isSuccess ? 'Email verified' : isLoading ? 'Verifying email' : 'Verification failed'}</AlertTitle>
              <AlertDescription className="mt-2 text-muted-foreground">{message}</AlertDescription>
            </Alert>

            {state === 'error' && (
              <Button asChild className="mt-5 !h-12 w-full !rounded-xl !bg-foreground !text-background hover:!bg-foreground/90">
                <Link to="/auth">Back to Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthConfirmPage;
