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
        "pb-20 md:pb-0 transition-all duration-300 w-full overflow-x-hidden",
        collapsed ? "md:ml-16" : "md:ml-64"
      )}>
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
