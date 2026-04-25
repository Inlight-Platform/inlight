import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Temporary full-screen maintenance overlay.
 * Toggle MAINTENANCE_MODE to false (or remove the wrapper in App.tsx) to restore normal behavior.
 */
const MaintenanceOverlay: React.FC = () => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Maintenance in progress"
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-[hsl(222_38%_5%)] text-white px-6"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(45_95%_58%)]" />
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Inlight is undergoing maintenance..
          </h1>
          <p className="text-sm md:text-base text-white/70 leading-relaxed">
            We're upgrading the platform to improve security and performance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;