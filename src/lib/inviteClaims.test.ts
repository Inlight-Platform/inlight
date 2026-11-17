import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const invalidateMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: invalidateMock } }));
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe('inviteClaims', () => {
  beforeEach(() => {
    vi.resetModules();
    rpcMock.mockReset();
    invalidateMock.mockReset().mockResolvedValue(undefined);
    toastErrorMock.mockReset();
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

  it('clears successful group and credit tokens and refreshes all group-admin queries', async () => {
    rpcMock.mockResolvedValue({ data: { group_admin_invite_status: 'claimed', credit_invite_claimed: true, credit_invite: { project_id: 'project_1' } }, error: null });
    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens('group-token', 'credit-token', 'project_1');
    await expect(claimStoredInvites()).resolves.toBe('project_1');
    expect(localStorage.getItem('inlight_platform_invite_token')).toBeNull();
    expect(localStorage.getItem('inlight_project_credit_invite_token')).toBeNull();
    expect(localStorage.getItem('inlight_project_credit_invite_project_id')).toBeNull();
    expect(invalidateMock.mock.calls.map(([arg]) => arg.queryKey)).toEqual([
      ['my-scoped-admin-groups'], ['my-groups'], ['group-admins'], ['group-dashboard-admins'],
      ['group-members'], ['group-dashboard-members'], ['group-active-member-count'], ['group-active-admin-user-ids'],
    ]);
  });

  it('clears each token only for its own successful outcome', async () => {
    rpcMock.mockResolvedValue({ data: { platform_invite_claimed: true, group_admin_invite_status: 'not_found', credit_invite_claimed: false }, error: null });
    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens('platform-token', 'credit-token', 'project_1');
    await claimStoredInvites();
    expect(localStorage.getItem('inlight_platform_invite_token')).toBeNull();
    expect(localStorage.getItem('inlight_project_credit_invite_token')).toBe('credit-token');
    expect(localStorage.getItem('inlight_project_credit_invite_project_id')).toBe('project_1');
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it.each(['unconfirmed', 'assignment_conflict', 'not_matching', 'not_found'])('retains a group token for %s while clearing a successful credit token', async (status) => {
    rpcMock.mockResolvedValue({ data: { group_admin_invite_status: status, credit_invite_claimed: true }, error: null });
    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens('group-token', 'credit-token', 'project_1');
    await claimStoredInvites();
    expect(localStorage.getItem('inlight_platform_invite_token')).toBe('group-token');
    expect(localStorage.getItem('inlight_project_credit_invite_token')).toBeNull();
    expect(invalidateMock).not.toHaveBeenCalled();
    if (status === 'assignment_conflict') expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining('already has a different admin assignment'), expect.anything());
    if (status === 'not_matching') expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining('different account'), expect.anything());
  });

  it('handles explicit already-claimed outcomes independently', async () => {
    rpcMock.mockResolvedValue({ data: { group_admin_invite_status: 'already_claimed', credit_invite: { reason: 'already_claimed' } }, error: null });
    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens('group-token', 'credit-token', null);
    await claimStoredInvites();
    expect(localStorage.getItem('inlight_platform_invite_token')).toBeNull();
    expect(localStorage.getItem('inlight_project_credit_invite_token')).toBeNull();
    expect(invalidateMock).toHaveBeenCalledTimes(8);
  });

  it('retains all tokens after a network failure', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('Network unavailable') });
    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens('group-token', 'credit-token', 'project_1');
    await expect(claimStoredInvites()).rejects.toThrow('Network unavailable');
    expect(localStorage.getItem('inlight_platform_invite_token')).toBe('group-token');
    expect(localStorage.getItem('inlight_project_credit_invite_token')).toBe('credit-token');
    expect(localStorage.getItem('inlight_project_credit_invite_project_id')).toBe('project_1');
  });

  it('does not clear tokens written again while an older claim is in flight', async () => {
    let finish!: (result: unknown) => void;
    rpcMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { claimStoredInvites, storeInviteTokens } = await import('@/lib/inviteClaims');
    storeInviteTokens('group-token', 'credit-token', 'project_1');
    const pending = claimStoredInvites();
    storeInviteTokens('group-token', 'new-credit-token', 'project_2');
    finish({ data: { group_admin_invite_status: 'claimed', credit_invite_claimed: true }, error: null });
    await pending;
    expect(localStorage.getItem('inlight_platform_invite_token')).toBe('group-token');
    expect(localStorage.getItem('inlight_project_credit_invite_token')).toBe('new-credit-token');
    expect(localStorage.getItem('inlight_project_credit_invite_project_id')).toBe('project_2');
  });
});
