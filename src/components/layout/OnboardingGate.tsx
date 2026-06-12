import React from 'react';

const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Onboarding gating disabled — users can access the app without completing the survey.
  return <>{children}</>;
};

export default OnboardingGate;
