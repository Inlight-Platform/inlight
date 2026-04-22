import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTour } from '@/hooks/useTour';
import { useAuth } from '@/hooks/useAuth';

type Phase = {
  route: string;
  steps: (userId: string) => DriveStep[];
};

const profileRoute = (userId: string) => `/profile/${userId}`;

const phases: Phase[] = [
  // 0 - Identity Phase (Profile)
  {
    route: '__profile__',
    steps: () => [
      {
        element: '[data-tour="profile-avatar"]',
        popover: {
          title: '👤 Step 1 of 7 — Your Identity',
          description:
            "First impressions matter! Upload a headshot or brand logo to start building your professional identity.",
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="profile-roles"]',
        popover: {
          title: '🎭 Roles & Affiliation',
          description:
            'What do you do? Add your primary roles (e.g., Actor, Producer) and your school or company affiliation.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="profile-credits"]',
        popover: {
          title: '🏆 Credits & Projects',
          description:
            'Showcase your work. Add past credits or start a new project to recruit collaborators.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  // 1 - Network Phase (People)
  {
    route: '/people',
    steps: () => [
      {
        element: '[data-tour="people-search"]',
        popover: {
          title: '🔎 Step 2 of 7 — Find Your Crew',
          description:
            'Looking for a DP, Lead Actor, or Stage Manager? Search the NYU ecosystem by department, role, or name. Try sending a connection request to start building your network.',
          side: 'bottom',
          align: 'start',
        },
      },
    ],
  },
  // 2 - Discovery Phase (Feed)
  {
    route: '/feed',
    steps: () => [
      {
        element: 'main',
        popover: {
          title: '📡 Step 3 of 7 — Discovery',
          description:
            "This is your pulse on the industry. Explore live projects, upcoming events, and special opportunities. See something you like? Click the 'Save' icon to store it on your profile.",
        },
      },
    ],
  },
  // 3 - Opportunity Phase (Jobs)
  {
    route: '/opportunities',
    steps: () => [
      {
        element: 'main',
        popover: {
          title: '💼 Step 4 of 7 — Opportunities',
          description:
            "Apply for roles directly. Your profile acts as your resume, so keep it updated! Pro Tip: When you're accepted to a project, your credit is automatically verified and added to your profile (including Role, Year, and Company) with a verified checkmark.",
        },
      },
    ],
  },
  // 4 - Market Phase (Industry Now / stage-whisper)
  {
    route: '/stage-whisper',
    steps: () => [
      {
        element: 'main',
        popover: {
          title: '🎟️ Step 5 of 7 — The Market',
          description:
            "See what's trending and grab tickets to live shows. Have your own production? List it here, set up your ticketing, and start earning revenue immediately.",
        },
      },
    ],
  },
  // 5 - Knowledge Phase (Resources)
  {
    route: '/resources',
    steps: () => [
      {
        element: 'main',
        popover: {
          title: '📚 Step 6 of 7 — Hidden Curriculum',
          description:
            "Access the 'hidden' curriculum. Find gatekept info on equity laws, agencies, and career stations not taught in the classroom.",
        },
      },
    ],
  },
  // 6 - Growth Phase (Pie chart)
  {
    route: '/pie-chart',
    steps: () => [
      {
        element: 'main',
        popover: {
          title: '📊 Step 7 of 7 — Network Health',
          description:
            'This is your Network Health. See a real-time breakdown of your connections and get prompts on how to diversify your circle for a more well-rounded career. Happy browsing!',
        },
      },
    ],
  },
];

export const OnboardingTour: React.FC = () => {
  const { isActive, currentStep, setStep, endTour } = useTour();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const driverRef = useRef<Driver | null>(null);
  const navigatedForStepRef = useRef<number>(-1);
  const advancingRef = useRef<boolean>(false);
  const mountedStepRef = useRef<number>(-1);

  // When a phase begins, ensure we're on the right route
  useEffect(() => {
    if (!isActive || !user) return;
    const phase = phases[currentStep];
    if (!phase) return;

    const target = phase.route === '__profile__' ? profileRoute(user.id) : phase.route;

    if (location.pathname !== target && navigatedForStepRef.current !== currentStep) {
      navigatedForStepRef.current = currentStep;
      navigate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep, user, location.pathname]);

  // Mount the driver instance for the current phase
  useEffect(() => {
    if (!isActive || !user) return;
    const phase = phases[currentStep];
    if (!phase) return;

    const expectedPath = phase.route === '__profile__' ? profileRoute(user.id) : phase.route;
    if (location.pathname !== expectedPath) return;

    // Avoid re-mounting driver for the same step
    if (mountedStepRef.current === currentStep && driverRef.current) return;

    // Wait for the page to render targets
    const timeoutId = setTimeout(() => {
      const steps = phase.steps(user.id);
      const isLastPhase = currentStep === phases.length - 1;
      advancingRef.current = false;

      // Compute global step numbering across all phases
      const totalSteps = phases.reduce((sum, p) => sum + p.steps(user.id).length, 0);
      const stepsBefore = phases
        .slice(0, currentStep)
        .reduce((sum, p) => sum + p.steps(user.id).length, 0);

      const d = driver({
        showProgress: true,
        progressText: `Step {{current}} of ${steps.length} · Phase ${currentStep + 1} of ${phases.length}`,
        animate: true,
        allowClose: false,
        overlayOpacity: 0.6,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: 'inlight-tour-popover',
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: isLastPhase ? 'Finish 🎉' : 'Next →',
        steps,
        onCloseClick: () => {
          advancingRef.current = false;
          try { d.destroy(); } catch { /* noop */ }
          endTour(false);
        },
        onDestroyStarted: () => {
          // Only advance when the user finished the last step of this phase
          const lastStep = d.isLastStep();
          try { d.destroy(); } catch { /* noop */ }
          if (lastStep) {
            advancingRef.current = true;
          }
        },
        onDestroyed: () => {
          driverRef.current = null;
          mountedStepRef.current = -1;
          if (!advancingRef.current) return;
          advancingRef.current = false;
          const nextStep = currentStep + 1;
          if (nextStep >= phases.length) {
            endTour(true);
          } else {
            setStep(nextStep);
          }
        },
      });

      driverRef.current = d;
      mountedStepRef.current = currentStep;
      d.drive();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      // Tear down silently — do NOT trigger advance
      if (driverRef.current) {
        advancingRef.current = false;
        try { driverRef.current.destroy(); } catch { /* noop */ }
        driverRef.current = null;
        mountedStepRef.current = -1;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep, user, location.pathname]);

  // Floating skip button
  if (!isActive) return null;

  return (
    <button
      onClick={() => {
        if (driverRef.current) {
          try { driverRef.current.destroy(); } catch { /* noop */ }
          driverRef.current = null;
        }
        endTour(true);
      }}
      className="fixed bottom-4 right-4 z-[10001] px-4 py-2 rounded-full bg-background/90 backdrop-blur border border-border shadow-lg text-sm font-medium hover:bg-accent transition-colors"
      aria-label="Skip onboarding tour"
    >
      Skip tour
    </button>
  );
};

export default OnboardingTour;
