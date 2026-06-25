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
  'Only university .edu email addresses or invited emails are allowed to sign up.';

export const formatSignInErrorMessage = (message: string) => {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again or reset your password.';
  }

  return message;
};
