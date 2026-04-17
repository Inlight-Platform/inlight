import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MainNav from './MainNav';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import OnboardingTour from '@/components/tour/OnboardingTour';
import { recordRoute } from '@/lib/safeBack';

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  const { collapsed } = useSidebarState();
  const location = useLocation();

  // Track the most recently visited sidebar route so back-arrows can
  // safely return to it instead of landing on a non-sidebar URL.
  useEffect(() => {
    recordRoute(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-[hsl(222_35%_6%)] via-[hsl(222_38%_5%)] to-[hsl(222_40%_4%)]">
      {/* Subtle background pattern overlay */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(45 95% 58%) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      <MainNav />
      {/* Main content - adapts to sidebar collapsed state */}
      <main className={cn(
        "pb-20 md:pb-0 transition-all duration-300 w-full max-w-full min-w-0 overflow-x-hidden relative z-10",
        collapsed ? "md:pl-16" : "md:pl-64"
      )}>
        {children}
      </main>

      {/* First-time user onboarding tour */}
      <OnboardingTour />
    </div>
  );
};

export default PageLayout;
