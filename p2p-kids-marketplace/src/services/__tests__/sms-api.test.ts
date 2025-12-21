import * as sms from '../../services/sms';

describe('SMS API call', () => {
  it('sendSMS rejects if EXPO_PUBLIC_SMS_API_URL not configured', async () => {
    const phone = '+15555550123';
    // ensure env var not set
    process.env.EXPO_PUBLIC_SMS_API_URL = '';
    await expect(sms.sendVerificationCode(phone)).rejects.toThrow('SMS API URL not configured');
  });
});
