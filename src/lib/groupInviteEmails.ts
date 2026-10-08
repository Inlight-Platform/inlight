export type BulkEmailParseResult = {
  validEmails: string[];
  invalidEmails: string[];
  duplicateEmails: string[];
};

const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const emailHeaderPattern = /^(email|emails|email_address|email address)$/;

export const parseBulkEmails = (value: string): BulkEmailParseResult => {
  const body = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !emailHeaderPattern.test(line.toLowerCase()))
    .join('\n');
  const tokens = body
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const validEmails: string[] = [];
  const invalidEmails: string[] = [];
  const duplicateEmails: string[] = [];

  tokens.forEach((email) => {
    if (emailHeaderPattern.test(email)) {
      return;
    }

    if (!emailPattern.test(email)) {
      invalidEmails.push(email);
      return;
    }

    if (seen.has(email)) {
      duplicateEmails.push(email);
      return;
    }

    seen.add(email);
    validEmails.push(email);
  });

  return { validEmails, invalidEmails, duplicateEmails };
};
