import React from 'react';
import MainNav from './MainNav';

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      {/* Main content - offset for sidebar on desktop, padding for bottom nav on mobile */}
      <main className="md:ml-64 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
