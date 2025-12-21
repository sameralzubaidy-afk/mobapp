import { generateVerificationCode } from '../../services/sms';

describe('SMS Service', () => {
  it('generateVerificationCode returns 6 digit code', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });
});
