import { describe, expect, it } from 'vitest';
import { parseBulkEmails } from './groupInviteEmails';

describe('parseBulkEmails', () => {
  it('normalizes, deduplicates, and reports invalid emails', () => {
    expect(
      parseBulkEmails('ClelyFernandes19@gmail.com, bad-email\nclelyf@yahoo.com clelyf@yahoo.com')
    ).toEqual({
      validEmails: ['clelyfernandes19@gmail.com', 'clelyf@yahoo.com'],
      invalidEmails: ['bad-email'],
      duplicateEmails: ['clelyf@yahoo.com'],
    });
  });

  it('skips common CSV email headers', () => {
    expect(
      parseBulkEmails('email\nemails\nemail_address\nemail address\nstudent@example.edu')
    ).toEqual({
      validEmails: ['student@example.edu'],
      invalidEmails: [],
      duplicateEmails: [],
    });
  });
});
