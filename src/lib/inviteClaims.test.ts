import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('inviteClaims', () => {
  beforeEach(() => {
    vi.resetModules();
    rpcMock.mockReset();
    window.localStorage.clear();
  });

  it('returns the project id embedded in the email URL when the RPC has no project id', async () => {
    rpcMock.mockResolvedValue({
      data: { credit_invite: { claimed: true } },
      error: null,
    });

    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens(null, 'token_abc', 'project_123');

    await expect(claimStoredInvites()).resolves.toBe('project_123');
    expect(rpcMock).toHaveBeenCalledWith('claim_invites_on_signup', {
      _platform_token: undefined,
      _credit_token: 'token_abc',
    });
    expect(window.localStorage.getItem('inlight_project_credit_invite_token')).toBeNull();
    expect(window.localStorage.getItem('inlight_project_credit_invite_project_id')).toBeNull();
  });

  it('uses the project id returned by the RPC when the email URL does not include one', async () => {
    rpcMock.mockResolvedValue({
      data: { credit_invite: { claimed: true, project_id: 'project_456' } },
      error: null,
    });

    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens(null, 'token_def', null);

    await expect(claimStoredInvites()).resolves.toBe('project_456');
  });
});
