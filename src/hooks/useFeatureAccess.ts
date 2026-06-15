import { toast } from 'sonner';

/**
 * Feature-access gate. Currently allows all signed-in users to manage jobs
 * and projects. Kept as a hook so we can later restrict by plan/beta group
 * without touching call sites.
 */
export function useFeatureAccess() {
  const showRestrictedToast = (feature: 'jobs' | 'projects' | string) => {
    toast.error(`You don't have access to ${feature} right now.`);
  };

  return {
    canManageJobs: true,
    canManageProjects: true,
    canManageEvents: true,
    showRestrictedToast,
  };
}

export default useFeatureAccess;