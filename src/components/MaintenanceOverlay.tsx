import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full-screen maintenance overlay.
 * Blocks all interaction with the app underneath.
 * To disable: set MAINTENANCE_MODE = false in src/App.tsx
 */
const MaintenanceOverlay: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[hsl(222_35%_6%)] via-[hsl(222_38%_5%)] to-[hsl(222_40%_4%)]"
      role="dialog"
      aria-modal="true"
      aria-label="Maintenance mode"
      onClickCapture={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(45 95% 58%) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-8 text-center flex flex-col items-center gap-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />

        <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
          Inlight is undergoing maintenance.
        </h1>

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          We're upgrading the platform to improve security and performance.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;