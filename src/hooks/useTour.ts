import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const LS_KEY = 'inlight_tour_completed';
const LS_ACTIVE_KEY = 'inlight_tour_active';
const LS_STEP_KEY = 'inlight_tour_step';

export function useTour() {
  const { user } = useAuth();
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState<boolean>(() => {
    return localStorage.getItem(LS_ACTIVE_KEY) === '1';
  });
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const v = localStorage.getItem(LS_STEP_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  });

  // Load completion state from DB (with localStorage cache for fast paint)
  useEffect(() => {
    if (!user) {
      setHasCompleted(null);
      return;
    }

    // Optimistic from localStorage
    const cached = localStorage.getItem(LS_KEY);
    if (cached === '1') setHasCompleted(true);

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('has_completed_tour')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) return;
      const completed = !!data?.has_completed_tour;
      setHasCompleted(completed);
      localStorage.setItem(LS_KEY, completed ? '1' : '0');

      // Auto-start tour for first-time users
      if (!completed && localStorage.getItem(LS_ACTIVE_KEY) !== '0') {
        if (!isActive) {
          setIsActive(true);
          localStorage.setItem(LS_ACTIVE_KEY, '1');
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.setItem(LS_ACTIVE_KEY, '1');
    localStorage.setItem(LS_STEP_KEY, '0');
  }, []);

  const setStep = useCallback((step: number) => {
    setCurrentStep(step);
    localStorage.setItem(LS_STEP_KEY, String(step));
  }, []);

  const endTour = useCallback(async (completed: boolean = true) => {
    setIsActive(false);
    localStorage.setItem(LS_ACTIVE_KEY, '0');
    localStorage.removeItem(LS_STEP_KEY);
    setCurrentStep(0);

    if (completed && user) {
      setHasCompleted(true);
      localStorage.setItem(LS_KEY, '1');
      await supabase
        .from('profiles')
        .update({ has_completed_tour: true })
        .eq('user_id', user.id);
    }
  }, [user]);

  return {
    hasCompleted,
    isActive,
    currentStep,
    startTour,
    setStep,
    endTour,
  };
}
