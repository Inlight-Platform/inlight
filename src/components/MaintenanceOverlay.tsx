import React from 'react';
import logo from '@/assets/inlight-logo.jpeg';

const MaintenanceOverlay: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[hsl(222_35%_6%)] via-[hsl(222_38%_5%)] to-[hsl(222_40%_4%)] px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(45 95% 58%) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 max-w-lg w-full text-center flex flex-col items-center gap-6">
        <img
          src={logo}
          alt="Inlight"
          className="w-24 h-24 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
        />
        <h1
          id="maintenance-title"
          className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight"
        >
          We are currently upgrading Inlight to serve you better. We will be back shortly.
        </h1>
        <p className="text-base md:text-lg text-muted-foreground italic">
          Thank you for your patience — The Inlight Team
        </p>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;