export const SIGNUP_EMAIL_ALLOWLIST = [
  'info@inlight.social',
  'alabfestival@gmail.com',
  'clelyfdes@gmail.com',
  'clelyfernandes19@gmail.com',
  'baileymadison941@gmail.com',
];

export const isAllowedSignupEmail = (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail.endsWith('.edu') || SIGNUP_EMAIL_ALLOWLIST.includes(normalizedEmail);
};

export const signupEmailPolicyMessage =
  'Only university .edu email addresses are allowed to sign up.';

export const formatSignInErrorMessage = (message: string) => {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid email or password. If you had an account before the migration, reset your password once, then sign in with the new password.';
  }

  return message;
};
