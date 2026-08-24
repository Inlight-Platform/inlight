import { supabase } from '@/integrations/supabase/client';

const platformInviteStorageKey = 'inlight_platform_invite_token';
const projectCreditInviteStorageKey = 'inlight_project_credit_invite_token';
const projectCreditInviteProjectStorageKey = 'inlight_project_credit_invite_project_id';

type CreditInviteClaimResult = {
  credit_invite?: {
    project_id?: string | null;
  } | null;
};

let pendingClaim: Promise<string | null> | null = null;

export const storeInviteTokens = (
  platformToken?: string | null,
  creditToken?: string | null,
  creditProjectId?: string | null
) => {
  const normalizedPlatformToken = platformToken?.trim();
  const normalizedCreditToken = creditToken?.trim();
  const normalizedCreditProjectId = creditProjectId?.trim();

  if (normalizedPlatformToken) {
    localStorage.setItem(platformInviteStorageKey, normalizedPlatformToken);
  }

  if (normalizedCreditToken) {
    localStorage.setItem(projectCreditInviteStorageKey, normalizedCreditToken);
  }

  if (normalizedCreditProjectId) {
    localStorage.setItem(projectCreditInviteProjectStorageKey, normalizedCreditProjectId);
  }
};

export const hasStoredInviteTokens = () =>
  Boolean(
    localStorage.getItem(platformInviteStorageKey) ||
    localStorage.getItem(projectCreditInviteStorageKey)
  );

export const claimStoredInvites = () => {
  if (pendingClaim) {
    return pendingClaim;
  }

  pendingClaim = (async () => {
    const platformToken = localStorage.getItem(platformInviteStorageKey);
    const creditToken = localStorage.getItem(projectCreditInviteStorageKey);
    const creditProjectId = localStorage.getItem(projectCreditInviteProjectStorageKey);

    if (!platformToken && !creditToken) {
      return null;
    }

    const { data, error } = await supabase.rpc('claim_invites_on_signup', {
      _platform_token: platformToken || undefined,
      _credit_token: creditToken || undefined,
    });

    if (error) {
      throw error;
    }

    localStorage.removeItem(platformInviteStorageKey);
    localStorage.removeItem(projectCreditInviteStorageKey);
    localStorage.removeItem(projectCreditInviteProjectStorageKey);

    return ((data as CreditInviteClaimResult | null)?.credit_invite?.project_id || creditProjectId || null);
  })().finally(() => {
    pendingClaim = null;
  });

  return pendingClaim;
};
