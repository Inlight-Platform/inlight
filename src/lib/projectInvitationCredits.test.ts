import { beforeEach, describe, expect, it, vi } from 'vitest';

const tableMocks = vi.hoisted(() => ({
  existingCredit: null as { id: string } | null,
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      expect(table).toBe('credits');

      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn((column: string, value: string) => {
          tableMocks.eqMock(column, value);
          return chain;
        }),
        ilike: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: tableMocks.existingCredit, error: null })),
        update: vi.fn((payload: unknown) => {
          tableMocks.updateMock(payload);
          return chain;
        }),
        insert: vi.fn(async (payload: unknown) => {
          tableMocks.insertMock(payload);
          return { error: null };
        }),
        then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
      };

      return chain;
    }),
  },
}));

describe('ensureAcceptedProjectCredit', () => {
  beforeEach(() => {
    tableMocks.existingCredit = null;
    tableMocks.insertMock.mockReset();
    tableMocks.updateMock.mockReset();
    tableMocks.eqMock.mockReset();
  });

  it('creates a verified credit for an accepted project role invite when no matching credit exists', async () => {
    const { ensureAcceptedProjectCredit } = await import('@/lib/projectInvitationCredits');

    await ensureAcceptedProjectCredit({
      userId: 'invitee_a',
      projectTitle: 'Test',
      roleName: 'Director',
    });

    expect(tableMocks.insertMock).toHaveBeenCalledWith({
      user_id: 'invitee_a',
      project: 'Test',
      role: 'Director',
      year: expect.any(Number),
      verified: true,
    });
    expect(tableMocks.updateMock).not.toHaveBeenCalled();
  });

  it('verifies an existing matching credit instead of inserting a duplicate', async () => {
    tableMocks.existingCredit = { id: 'credit_1' };
    const { ensureAcceptedProjectCredit } = await import('@/lib/projectInvitationCredits');

    await ensureAcceptedProjectCredit({
      userId: 'invitee_a',
      projectTitle: 'Test',
      roleName: 'Director',
    });

    expect(tableMocks.updateMock).toHaveBeenCalledWith({ verified: true });
    expect(tableMocks.eqMock).toHaveBeenCalledWith('id', 'credit_1');
    expect(tableMocks.insertMock).not.toHaveBeenCalled();
  });
});
