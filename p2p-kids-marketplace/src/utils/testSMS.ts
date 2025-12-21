import { sendVerificationCode } from '@/services/sms';

export const testSMSSending = async (phoneNumber = '+15555555555') => {
  try {
    const res = await sendVerificationCode(phoneNumber);
    console.log('Test SMS sent:', res);
    return res;
  } catch (error) {
    console.error('SMS sending test failed:', error);
    return { success: false, error };
  }
};

// Self-invoking run if executed directly
if (require.main === module) {
  (async () => {
    const result = await testSMSSending(process.env.TEST_SMS_NUMBER || '+15555555555');
    console.log('done', result);
  })();
}
