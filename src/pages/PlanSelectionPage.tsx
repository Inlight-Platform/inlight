import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Check, Loader2, GraduationCap, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const PRO_FEATURES = [
  'Access all profiles & projects',
  'Send unlimited messages',
  'Priority job alerts',
  'Full credibility dashboard',
  'Unlimited connections',
];

const PlanSelectionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  // Handle return from Stripe checkout success
  useEffect(() => {
    if (searchParams.get('success') === 'true' && user) {
      // Webhook will set plan_type to 'pro', but also update client-side as fallback
      supabase
        .from('profiles')
        .update({ plan_type: 'pro' })
        .eq('user_id', user.id)
        .then(() => {
          navigate('/feed', { replace: true });
        });
    }
  }, [searchParams, user, navigate]);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error('Failed to start checkout. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ plan_type: 'free' })
        .eq('user_id', user?.id);
      if (error) throw error;
      navigate('/feed', { replace: true });
    } catch (err: any) {
      toast.error('Something went wrong.');
      console.error(err);
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center">
          <GraduationCap className="h-7 w-7 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground tracking-tight">Inlight</span>
      </div>

      {/* Headline */}
      <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-2">
        Get full access.
      </h1>
      <p className="text-muted-foreground text-center mb-8 text-base md:text-lg">
        Upgrade for only $10/month — Cancel anytime.
      </p>

      {/* Pro Card */}
      <div className="w-full max-w-sm">
        <div className="relative rounded-2xl border-2 border-primary bg-card p-6 shadow-xl">
          {/* Popular badge */}
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Popular
          </span>

          <h2 className="text-xl font-bold text-foreground mt-2 mb-1">Pro</h2>
          <p className="text-muted-foreground text-sm mb-5">Everything you need to grow.</p>

          <ul className="space-y-3 mb-6">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              'Upgrade for $10 / mo'
            )}
          </button>
        </div>

        {/* Free option */}
        <div className="text-center mt-5">
          <button
            onClick={handleSkip}
            disabled={isSkipping}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors disabled:opacity-50"
          >
            {isSkipping ? 'Setting up…' : 'Or continue for free'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanSelectionPage;
