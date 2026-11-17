import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queryClient } from '@/lib/queryClient';

const platformInviteStorageKey = 'inlight_platform_invite_token';
const projectCreditInviteStorageKey = 'inlight_project_credit_invite_token';
const projectCreditInviteProjectStorageKey = 'inlight_project_credit_invite_project_id';
const platformInviteRevisionKey = 'inlight_platform_invite_revision';
const projectCreditInviteRevisionKey = 'inlight_project_credit_invite_revision';

type InviteClaimResult = {
  platform_invite_claimed?: boolean;
  platform_invite_status?: string;
  group_admin_invite_status?: string;
  credit_invite_claimed?: boolean;
  credit_invite?: {
    project_id?: string | null;
    claimed?: boolean;
    status?: string;
    reason?: string;
  } | null;
};

let pendingClaim: Promise<string | null> | null = null;
let revisionCounter = 0;
const newRevision = () => `${Date.now()}-${Math.random()}-${++revisionCounter}`;

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
    localStorage.setItem(platformInviteRevisionKey, newRevision());
  }

  if (normalizedCreditToken) {
    localStorage.setItem(projectCreditInviteStorageKey, normalizedCreditToken);
    localStorage.setItem(projectCreditInviteRevisionKey, newRevision());
  }

  if (normalizedCreditProjectId) {
    localStorage.setItem(projectCreditInviteProjectStorageKey, normalizedCreditProjectId);
    if (!normalizedCreditToken) localStorage.setItem(projectCreditInviteRevisionKey, newRevision());
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
    const platformRevision = localStorage.getItem(platformInviteRevisionKey);
    const creditRevision = localStorage.getItem(projectCreditInviteRevisionKey);

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

    const result = data as InviteClaimResult | null;
    const groupStatus = result?.group_admin_invite_status;
    const groupClaimed = groupStatus === 'claimed' || groupStatus === 'already_claimed';
    const platformClaimed = result?.platform_invite_claimed === true || result?.platform_invite_status === 'already_claimed';
    const creditClaimed = result?.credit_invite_claimed === true || result?.credit_invite?.claimed === true ||
      result?.credit_invite?.status === 'already_claimed' || result?.credit_invite?.reason === 'already_claimed';

    if (platformToken && (groupClaimed || platformClaimed) &&
        localStorage.getItem(platformInviteStorageKey) === platformToken &&
        localStorage.getItem(platformInviteRevisionKey) === platformRevision) {
      localStorage.removeItem(platformInviteStorageKey);
      localStorage.removeItem(platformInviteRevisionKey);
    }
    if (creditToken && creditClaimed &&
        localStorage.getItem(projectCreditInviteStorageKey) === creditToken &&
        localStorage.getItem(projectCreditInviteRevisionKey) === creditRevision) {
      localStorage.removeItem(projectCreditInviteStorageKey);
      localStorage.removeItem(projectCreditInviteRevisionKey);
      if (localStorage.getItem(projectCreditInviteProjectStorageKey) === creditProjectId) {
        localStorage.removeItem(projectCreditInviteProjectStorageKey);
      }
    }

    if (groupClaimed) {
      void Promise.all(['my-scoped-admin-groups', 'my-groups', 'group-admins', 'group-dashboard-admins',
        'group-members', 'group-dashboard-members', 'group-active-member-count', 'group-active-admin-user-ids']
        .map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
        .catch((error) => console.error('Could not refresh group admin queries:', error));
    } else if (groupStatus === 'assignment_conflict') {
      toast.error('This account already has a different admin assignment in this group. Contact a group or platform admin for help.', { id: 'group-admin-invite-conflict' });
    } else if (groupStatus === 'not_matching') {
      toast.error('This admin invitation belongs to a different account. Sign in with the invited email address.', { id: 'group-admin-invite-mismatch' });
    }

    return (result?.credit_invite?.project_id || creditProjectId || null);
  })().finally(() => {
    pendingClaim = null;
  });

  return pendingClaim;
};
