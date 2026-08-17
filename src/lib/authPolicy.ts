import { emailNotConfirmedMessage } from './authVerification';

export const formatSignInErrorMessage = (message: string) => {
  if (message === emailNotConfirmedMessage) {
    return message;
  }

  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again or reset your password.';
  }

  return message;
};
