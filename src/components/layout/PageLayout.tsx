import React from 'react';
import MainNav from './MainNav';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  const { collapsed } = useSidebarState();

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <MainNav />
      {/* Main content - adapts to sidebar collapsed state */}
      <main className={cn(
        // Use padding-left (not margin-left) so the sidebar offset doesn't increase total width.
        "pb-20 md:pb-0 transition-all duration-300 w-full max-w-full min-w-0 overflow-x-hidden",
        collapsed ? "md:pl-16" : "md:pl-64"
      )}>
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
