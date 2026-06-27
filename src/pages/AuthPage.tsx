import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { accountAlreadyExistsMessage, useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { Sparkle } from '@/components/Sparkle';
import { Starfield } from '@/components/Starfield';
import { useForceTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { formatSignInErrorMessage } from '@/lib/authPolicy';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset';

interface AuthRouteState {
  email?: string;
  password?: string;
  displayName?: string;
  mode?: AuthView;
  from?: Location;
}

const fieldClass =
  'h-12 rounded-xl border-border bg-secondary/40 text-sm text-white placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-[hsl(45_95%_58%/0.55)] focus-visible:ring-offset-0';

const primaryButtonClass =
  '!h-12 !rounded-xl !bg-none !bg-foreground !text-background font-medium tracking-wide hover:!bg-none hover:!bg-foreground/90';

const secondaryButtonClass =
  '!h-12 !rounded-xl !border-border !bg-none !bg-secondary/30 !text-muted-foreground hover:!bg-none hover:!bg-secondary/50 hover:!text-white';

const getPasswordChecks = (value: string) => [
  { label: 'At least 8 characters', isMet: value.length >= 8 },
  { label: 'One capital letter', isMet: /[A-Z]/.test(value) },
  { label: 'One small letter', isMet: /[a-z]/.test(value) },
  { label: 'One number', isMet: /\d/.test(value) },
  { label: 'One special character', isMet: /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(value) },
];

const passwordMeetsPolicy = (value: string) => getPasswordChecks(value).every((check) => check.isMet);

const isPasswordPolicyError = (message: string) => {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('password should contain') || normalizedMessage.includes('weak password');
};

const PasswordChecklist: React.FC<{ password: string }> = ({ password }) => (
  <div className="rounded-2xl border border-border bg-secondary/25 p-3">
    <p className="mb-2 text-xs text-muted-foreground">Use a password with:</p>
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      {getPasswordChecks(password).map((check) => {
        const Icon = check.isMet ? CheckCircle2 : Circle;

        return (
          <div
            key={check.label}
            className={cn(
              'flex items-center gap-2 transition-colors',
              check.isMet ? 'text-glow' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{check.label}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  ariaRequired?: boolean;
}> = ({ id, value, onChange, placeholder = '••••••••', required, minLength, ariaRequired }) => {
  const [isVisible, setIsVisible] = useState(false);
  const VisibilityIcon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        id={id}
        type={isVisible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        aria-required={ariaRequired}
        className={cn(fieldClass, 'pr-12')}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition hover:text-white"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        aria-pressed={isVisible}
      >
        <VisibilityIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

const AuthFrame: React.FC<{
  children: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  caption: string;
  maxWidth?: string;
}> = ({ children, eyebrow, title, caption, maxWidth = 'max-w-md' }) => (
  <main className="dark relative min-h-screen overflow-hidden bg-night text-foreground">
    <div className="fixed inset-0 -z-10 bg-night">
      <div className="absolute inset-0 bg-aurora opacity-70" />
      <Starfield density={110} />
    </div>

    <nav className="fixed top-0 inset-x-0 z-50 px-6 sm:px-10 py-5 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <img src={inlightLogo} alt="Inlight" className="h-8 w-8 rounded-full object-cover" />
      </Link>
      <Link
        to="/"
        className="text-xs tracking-[0.25em] uppercase px-4 py-2 rounded-full border border-border hover:border-glow hover:text-glow transition"
      >
        Back home
      </Link>
    </nav>

    <section className="relative flex min-h-screen items-center justify-center px-6 py-28">
      <div className={cn('relative w-full text-center', maxWidth)}>
        <div className="mb-8 flex justify-center gap-2 text-glow">
          <Sparkle size={16} className="opacity-60" />
          <Sparkle size={24} />
          <Sparkle size={12} className="opacity-40" />
        </div>
        <div className="mb-5 text-[11px] tracking-[0.4em] uppercase text-muted-foreground">
          {eyebrow}
        </div>
        <h1 className="font-editorial text-5xl leading-[1.05] tracking-tight text-white sm:text-7xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted-foreground">
          {caption}
        </p>
        <div className="mt-10 rounded-3xl border border-border bg-card/60 p-6 text-left shadow-soft backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </section>
  </main>
);

const AuthPage: React.FC = () => {
  useForceTheme('dark');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const routeState = (location.state || {}) as AuthRouteState;
  const redirectPath = routeState.from
    ? `${routeState.from.pathname}${routeState.from.search}${routeState.from.hash}`
    : '/feed';
  const mode = searchParams.get('mode');
  const inviteToken = searchParams.get('invite')?.trim() || null;
  const creditInviteToken = searchParams.get('credit_invite')?.trim() || null;
  const isInviteSignup = Boolean(inviteToken || creditInviteToken);
  
  const getInitialView = (): AuthView => {
    if (routeState.mode) return routeState.mode;
    if (mode === 'signup') return 'signup';
    if (mode === 'reset') return 'reset';
    return 'login';
  };
  
  const [view, setView] = useState<AuthView>(getInitialView());
  const [email, setEmail] = useState(routeState.email || '');
  const [password, setPassword] = useState(routeState.password || '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState(routeState.displayName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showSignupPasswordChecklist, setShowSignupPasswordChecklist] = useState(false);
  
  const {
    user,
    loading,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    checkEmailExists,
    isPasswordRecovery,
    recoveryError,
  } = useAuth();
  const navigate = useNavigate();

  // Handle password recovery mode - detect when user arrives via reset link
  useEffect(() => {
    if (isPasswordRecovery) {
      setView('reset');
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    // Don't redirect if in password recovery mode
    if (!loading && user && view !== 'reset' && !isPasswordRecovery) {
      navigate(redirectPath, { replace: true });
    }
  }, [user, loading, navigate, view, isPasswordRecovery, redirectPath]);

  useEffect(() => {
    if (mode === 'reset') {
      setView('reset');
    } else if (mode === 'signup') {
      setView('signup');
    }
  }, [mode]);

  const openForgotPassword = () => {
    setView('forgot');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(formatSignInErrorMessage(error.message));
    } else {
      toast.success('Welcome back!');
      try {
        const { data: facultyGroup } = await (supabase.rpc as any)('get_my_faculty_group');
        const first = Array.isArray(facultyGroup) ? facultyGroup[0] : facultyGroup;
        if (first?.slug) {
          navigate(`/groups/${first.slug}`, { replace: true });
        } else {
          navigate(redirectPath, { replace: true });
        }
      } catch {
        navigate(redirectPath, { replace: true });
      }
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      if (!passwordMeetsPolicy(password)) {
        setShowSignupPasswordChecklist(true);
        return;
      }

      const { exists: emailExists, error: emailCheckError } = await checkEmailExists(email);

      if (emailCheckError) {
        console.error('Signup email availability check failed:', emailCheckError);
        toast.error('We could not check that email yet. Please try again.');
        return;
      }

      if (!emailCheckError && emailExists) {
        toast.error(accountAlreadyExistsMessage);
        setView('login');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      const { data, error } = await signUp(email, password, displayName, inviteToken, creditInviteToken);

      if (error) {
        if (isPasswordPolicyError(error.message)) {
          setShowSignupPasswordChecklist(true);
        } else if (error.message === accountAlreadyExistsMessage) {
          toast.error(accountAlreadyExistsMessage);
          setView('login');
          setPassword('');
          setConfirmPassword('');
        } else {
          toast.error(error.message);
        }
      } else if (!data?.session) {
        toast.success(
          isInviteSignup
            ? 'Account created. Check your email and confirm your account before signing in.'
            : 'Account created. Check your .edu inbox and confirm your email before signing in.'
        );
        setView('login');
      } else {
        toast.success('Account created! Welcome to Inlight.');
        navigate(redirectPath, { replace: true });
      }
    } catch (error) {
      console.error('Signup failed:', error);
      toast.error(error instanceof Error ? error.message : 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    const { error } = await resetPassword(email);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset email sent. Check your inbox for the link.');
      setView('login');
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordMeetsPolicy(password)) {
      toast.error('Password must be at least 8 characters and include uppercase, lowercase, number, and special characters.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    const { error } = await updatePassword(password);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      navigate(redirectPath, { replace: true });
    }

    setIsLoading(false);
  };

  if (loading) {
    return (
      <AuthFrame
        eyebrow="Opening Inlight"
        title={<>Hold <em className="italic text-accent-blue font-normal">tight</em>.</>}
        caption="We are checking your session."
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-glow" />
        </div>
      </AuthFrame>
    );
  }

  // Reset password view
  if (view === 'reset') {
    // Show loading while waiting for password recovery session to be established
    if (loading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // If no user session and not in password recovery, the link might be invalid/expired
    if ((!user && !isPasswordRecovery) || recoveryError) {
      return (
        <AuthFrame
          eyebrow="Reset link"
          title={<>Link <em className="italic text-accent-blue font-normal">expired</em>.</>}
          caption="This password reset link has expired or is invalid. Request a fresh one to continue."
        >
          {recoveryError && (
            <Alert className="mb-4 border-destructive/40 bg-destructive/10 text-white" variant="destructive">
              <AlertTitle>Reset link could not be verified</AlertTitle>
              <AlertDescription>{recoveryError}</AlertDescription>
            </Alert>
          )}
          <Button
            className={cn('w-full', primaryButtonClass)}
            onClick={() => {
              openForgotPassword();
              navigate('/auth');
            }}
          >
            Request New Reset Link
          </Button>
        </AuthFrame>
      );
    }

    return (
      <AuthFrame
        eyebrow="Password recovery"
        title={<>Set a new <em className="italic text-accent-blue font-normal">password</em>.</>}
        caption="Choose a new password below."
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              New Password
            </Label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={setPassword}
              required
              minLength={8}
            />
            <PasswordChecklist password={password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Confirm Password
            </Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className={cn('w-full', primaryButtonClass)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </form>
      </AuthFrame>
    );
  }

  // Forgot password view
  if (view === 'forgot') {
    return (
      <AuthFrame
        eyebrow="Account recovery"
        title={<>Reset your <em className="italic text-accent-blue font-normal">password</em>.</>}
        caption="Enter your account email and we will send you a reset link."
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Email
            </Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <Button type="submit" className={cn('w-full', primaryButtonClass)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn('w-full', secondaryButtonClass)}
            onClick={() => setView('login')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </form>
      </AuthFrame>
    );
  }

  // Login/Signup view
  return (
    <AuthFrame
      eyebrow={view === 'signup' ? 'Create account' : 'Welcome back'}
      title={
        view === 'signup' ? (
          <>
            Step into <em className="italic text-accent-blue font-normal">the light</em>.
          </>
        ) : (
          <>
            Return to <em className="italic text-accent-blue font-normal">Inlight</em>.
          </>
        )
      }
      caption={
        view === 'signup'
          ? 'Claim your place in the network built by, and for, the next generation of entertainment.'
          : 'Sign in to continue to your feed, projects, messages, and creative network.'
      }
    >
      <div className="relative mb-6 grid grid-cols-2 rounded-full bg-secondary/60 p-1">
        <button
          type="button"
          onClick={() => setView('login')}
          className={cn(
            'rounded-full py-2.5 text-sm tracking-wide transition',
            view === 'login' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-white'
          )}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setView('signup')}
          className={cn(
            'rounded-full py-2.5 text-sm tracking-wide transition',
            view === 'signup' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-white'
          )}
        >
          Create account
        </button>
      </div>

      {view === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Password
            </Label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={setPassword}
              required
            />
          </div>
          <Button type="submit" className={cn('w-full', primaryButtonClass)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-accent-blue hover:underline"
            onClick={openForgotPassword}
          >
            Reset your password
          </button>
          <div className="border-t border-border/40 pt-3 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <GraduationCap className="inline h-3 w-3 mr-1" />
              Faculty? Sign in with your faculty email above.
            </p>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Full name
            </Label>
            <Input
              id="signup-name"
              type="text"
              placeholder="Jane Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Email
            </Label>
            <Input
              id="signup-email"
              type="email"
              placeholder={isInviteSignup ? 'you@example.com' : 'you@university.edu'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldClass}
            />
            {!isInviteSignup && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <GraduationCap className="h-3 w-3" />
                University emails are allowed automatically. Other emails need an invite.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Password
            </Label>
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={setPassword}
              ariaRequired
            />
            <PasswordChecklist password={password} />
          </div>
          <Button type="submit" className={cn('w-full', primaryButtonClass)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (password || showSignupPasswordChecklist) && passwordMeetsPolicy(password) ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create my account
              </>
            ) : (
              'Create my account'
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button type="button" onClick={() => setView('login')} className="text-accent-blue hover:underline">
              Sign in
            </button>
          </p>
        </form>
      )}
    </AuthFrame>
  );
};

export default AuthPage;
