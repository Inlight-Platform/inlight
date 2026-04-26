import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Toggle this flag to enable/disable the full-screen maintenance overlay.
 * When true, the overlay blocks all interaction with the app.
 */
export const MAINTENANCE_MODE = true;

const MaintenanceOverlay: React.FC = () => {
  if (!MAINTENANCE_MODE) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-background text-foreground px-6"
      style={{ backdropFilter: 'blur(8px)' }}
      aria-modal="true"
      role="dialog"
      onClickCapture={(e) => e.stopPropagation()}
      onKeyDownCapture={(e) => e.stopPropagation()}
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Inlight is undergoing maintenance.
        </h1>
        <p className="text-base text-foreground/80">
          Please check back in 1 hour.
        </p>
        <p className="text-sm text-muted-foreground">
          We're upgrading the platform to improve security and performance.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;