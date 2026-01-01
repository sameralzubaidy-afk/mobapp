import { sendVerificationCode } from '@/services/sms';

export const testSMSSending = async (phoneNumber = '+15555555555') => {
  try {
    const res = await sendVerificationCode(phoneNumber);
    console.log('Test SMS sent:', res);
    return res;
  } catch (error) {
    console.error('SMS sending test failed:', error);
    return { success: false, error: String(error) };
  }
};

// NOTE:
// This utility is intended to be imported and called from a test or script.
// Avoid attempting to execute it directly in the React Native runtime.
