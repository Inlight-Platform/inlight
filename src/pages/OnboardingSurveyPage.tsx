import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { DISCIPLINES, GOALS } from '@/data/disciplines';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Sparkles, Check } from 'lucide-react';

type Step = 0 | 1 | 2;

const OnboardingSurveyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(0);
  const [primary, setPrimary] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleSecondary = (d: string) => {
    setSecondary((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const toggleGoal = (g: string) => {
    setGoals((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= 3) {
        toast({ title: 'Pick up to 3', description: 'Choose your top 3 goals.' });
        return prev;
      }
      return [...prev, g];
    });
  };

  const submit = async () => {
    if (!user?.id || !primary || goals.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          primary_discipline: primary,
          secondary_disciplines: secondary,
          goals,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (error) {
        console.warn('Onboarding save failed, continuing anyway:', error.message);
      }
    } catch (err) {
      console.warn('Onboarding save threw, continuing anyway:', err);
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['onboarding-status', user.id] });
    qc.invalidateQueries({ queryKey: ['you-tab-survey', user.id] });
    navigate('/feed?tab=you', { replace: true });
  };

  const canNext =
    (step === 0 && !!primary) ||
    step === 1 ||
    (step === 2 && goals.length > 0);

  const steps = [
    { eyebrow: 'Step 1 of 3', q: 'Who are you?', hint: 'Pick your primary discipline.' },
    { eyebrow: 'Step 2 of 3', q: 'What other disciplines do you practice?', hint: 'Optional — pick as many as you like.' },
    { eyebrow: 'Step 3 of 3', q: 'What do you want to achieve on Inlight?', hint: 'Choose up to 3.' },
  ];

  const current = steps[step];

  const Pill = ({
    label,
    active,
    onClick,
  }: { label: string; active: boolean; onClick: () => void }) => (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`px-5 py-3 rounded-full border text-sm transition-all flex items-center gap-2 ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border hover:border-foreground/40 bg-background/60 backdrop-blur'
      }`}
    >
      {active && <Check className="w-3.5 h-3.5" />}
      {label}
    </motion.button>
  );

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute top-10 left-1/2 -translate-x-1/2 flex gap-2">
        {steps.map((_, i) => (
          <motion.span
            key={i}
            animate={{ width: i === step ? 32 : 8, opacity: i <= step ? 1 : 0.25 }}
            className="h-[2px] bg-primary rounded-full"
          />
        ))}
      </div>

      <div className="max-w-3xl w-full text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
            exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-6 flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" />
              {current.eyebrow}
            </div>
            <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] tracking-tight">
              {current.q}
            </h1>
            <p className="text-sm text-muted-foreground mt-3">{current.hint}</p>

            <div className="mt-12 flex flex-wrap justify-center gap-2.5 max-w-2xl mx-auto">
              {step === 0 &&
                DISCIPLINES.map((d) => (
                  <Pill key={d} label={d} active={primary === d} onClick={() => setPrimary(d)} />
                ))}
              {step === 1 &&
                DISCIPLINES.filter((d) => d !== primary).map((d) => (
                  <Pill
                    key={d}
                    label={d}
                    active={secondary.includes(d)}
                    onClick={() => toggleSecondary(d)}
                  />
                ))}
              {step === 2 &&
                GOALS.map((g) => (
                  <Pill key={g} label={g} active={goals.includes(g)} onClick={() => toggleGoal(g)} />
                ))}
            </div>

            <div className="mt-12 flex items-center justify-center gap-3">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((step - 1) as Step)}>
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  size="lg"
                  disabled={!canNext}
                  onClick={() => setStep((step + 1) as Step)}
                  className="rounded-full px-8"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled={!canNext || saving}
                  onClick={submit}
                  className="rounded-full px-8"
                >
                  {saving ? 'Saving…' : 'Enter Inlight'}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
};

export default OnboardingSurveyPage;