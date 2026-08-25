// File: p2p-kids-marketplace/src/services/__tests__/emailChange.test.ts
// Dev Task B02 (ACC-TC-B02): email-change verification service unit tests.

import { requestEmailChange, resendEmailChangeCode, verifyEmailChangeCode } from '../emailChange';
import { supabase } from '../supabase/client';

jest.mock('../supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;

describe('emailChange service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestEmailChange', () => {
    it('sends the new email to the auth-email-change function (action request)', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          message: 'Verification code sent to your new email.',
          newEmail: 'new@example.com',
        },
        error: null,
      });

      const result = await requestEmailChange('new@example.com');

      expect(mockInvoke).toHaveBeenCalledWith('auth-email-change', {
        body: { action: 'request', newEmail: 'new@example.com' },
      });
      expect(result.success).toBe(true);
      expect(result.newEmail).toBe('new@example.com');
    });
  });

  describe('verifyEmailChangeCode', () => {
    it('sends the code with action verify and returns the applied email', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          success: true,
          message: 'Your email has been updated.',
          newEmail: 'new@example.com',
        },
        error: null,
      });

      const result = await verifyEmailChangeCode('123456');

      expect(mockInvoke).toHaveBeenCalledWith('auth-email-change', {
        body: { action: 'verify', code: '123456' },
      });
      expect(result.success).toBe(true);
      expect(result.newEmail).toBe('new@example.com');
    });
  });

  describe('resendEmailChangeCode', () => {
    it('sends action resend', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: true, message: 'A new verification code was sent.' },
        error: null,
      });

      const result = await resendEmailChangeCode();

      expect(mockInvoke).toHaveBeenCalledWith('auth-email-change', {
        body: { action: 'resend' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('error handling (BP-39 FunctionsHttpError context parsing)', () => {
    it('parses the structured error body from a FunctionsHttpError context', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: {
            clone: () => ({
              json: async () => ({
                success: false,
                error: {
                  code: 'INVALID_CODE',
                  message: "That code didn't match. Check it and try again.",
                },
              }),
            }),
          },
        },
      });

      const result = await verifyEmailChangeCode('000000');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CODE');
      expect(result.error?.message).toBe("That code didn't match. Check it and try again.");
    });

    it('surfaces a generic message when the error has no parseable context', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Function invocation failed' },
      });

      const result = await requestEmailChange('new@example.com');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL');
      expect(result.error?.message).toBeTruthy();
    });

    it('treats a non-success data payload as a failure', async () => {
      mockInvoke.mockResolvedValue({
        data: { success: false, error: { code: 'EMAIL_IN_USE', message: 'Taken' } },
        error: null,
      });

      const result = await requestEmailChange('taken@example.com');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL');
    });
  });
});
