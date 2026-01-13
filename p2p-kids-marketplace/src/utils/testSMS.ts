import { sendVerificationCode } from '@/services/sms';

export const testSMSSending = async (phoneNumber = '+15555555555') => {
  try {
    const res = await sendVerificationCode(phoneNumber);
    return res;
  } catch (err) {
    const error = err as Error;
    console.warn('⚠️ SMS sending test failed:', error.message);
    return { success: false, error: error.message };
  }
};

// NOTE:
// This utility is intended to be imported and called from a test or script.
// Avoid attempting to execute it directly in the React Native runtime.
