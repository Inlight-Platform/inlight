import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Temporary full-screen maintenance overlay.
 * Toggle via MAINTENANCE_MODE in src/App.tsx.
 * UI-only — does not affect business logic, API calls, or routing logic.
 */
const MaintenanceOverlay: React.FC = () => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-foreground px-6"
      style={{
        // Block all interaction with anything beneath the overlay
        pointerEvents: 'auto',
      }}
      onClickCapture={(e) => e.stopPropagation()}
      onKeyDownCapture={(e) => e.stopPropagation()}
    >
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
        <div className="space-y-3">
          <h1
            id="maintenance-title"
            className="text-2xl md:text-3xl font-semibold tracking-tight"
          >
            Inlight is undergoing maintenance. Please check back in 1 hour.
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            We're upgrading the platform to improve security and performance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;