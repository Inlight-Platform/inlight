import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SUPABASE_URL } from '@/integrations/supabase/config';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { Sparkle } from '@/components/Sparkle';
import { Starfield } from '@/components/Starfield';
import { useForceTheme } from '@/hooks/useTheme';

const isValidRecoveryUrl = (value: string | null) => {
  if (!value) return false;

  try {
    const url = new URL(value);
    const supabaseUrl = new URL(SUPABASE_URL);

    return (
      url.protocol === 'https:' &&
      url.host === supabaseUrl.host &&
      url.pathname === '/auth/v1/verify' &&
      url.searchParams.get('type') === 'recovery'
    );
  } catch {
    return false;
  }
};

const AuthResetContinuePage: React.FC = () => {
  useForceTheme('dark');
  const [searchParams] = useSearchParams();
  const confirmationUrl = searchParams.get('confirmation_url');
  const canContinue = isValidRecoveryUrl(confirmationUrl);

  const continueReset = () => {
    if (!confirmationUrl || !canContinue) return;
    window.location.assign(confirmationUrl);
  };

  return (
    <main className="dark relative min-h-screen overflow-hidden bg-night text-foreground">
      <div className="fixed inset-0 -z-10 bg-night">
        <div className="absolute inset-0 bg-aurora opacity-70" />
        <Starfield density={110} />
      </div>

      <nav className="fixed top-0 inset-x-0 z-50 px-6 py-5 sm:px-10">
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
            Password recovery
          </div>
          <h1 className="font-editorial text-5xl leading-[1.05] tracking-tight text-white sm:text-7xl">
            Continue your <em className="font-normal italic text-accent-blue">reset</em>.
          </h1>

          <div className="mt-10 rounded-3xl border border-border bg-card/60 p-6 text-left shadow-soft backdrop-blur-xl sm:p-8">
            {canContinue ? (
              <Button
                type="button"
                className="!h-12 w-full !rounded-xl !bg-foreground !text-background hover:!bg-foreground/90"
                onClick={continueReset}
              >
                Continue to Password Reset
              </Button>
            ) : (
              <>
                <Alert className="mb-4 border-destructive/40 bg-destructive/10 text-white" variant="destructive">
                  <AlertTitle>Reset link could not be verified</AlertTitle>
                  <AlertDescription>
                    This reset link is invalid. Please request a fresh password reset email.
                  </AlertDescription>
                </Alert>
                <Button asChild className="!h-12 w-full !rounded-xl !bg-foreground !text-background hover:!bg-foreground/90">
                  <Link to="/auth">Request New Reset Link</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthResetContinuePage;
