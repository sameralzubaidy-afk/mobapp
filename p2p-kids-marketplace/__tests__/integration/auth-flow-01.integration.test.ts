// File: p2p-kids-marketplace/__tests__/integration/auth-flow-01.integration.test.ts
// MODULE-15.1: Auth Flow Integration Tests
// FLOW-01: Authentication & Session Management
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { loginWithContext, signupWithTrial } from '@/services/auth';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/phoneService';
import { supabase } from '@/services/supabase/client';
import { render } from '@testing-library/react-native';
import { theme } from '@/theme';
import { TextInput, Button } from '@/components/ui';
import React from 'react';

describe('FLOW-01: Authentication & Session Management (Integration)', () => {
  const RUN_SUPABASE_E2E = process.env.RUN_SUPABASE_E2E === 'true';
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123';
  const testPhone = '+12345678901';
  let testUserId: string;
  let canRunSupabaseTests = RUN_SUPABASE_E2E;

  beforeAll(async () => {
    if (!RUN_SUPABASE_E2E) {
      canRunSupabaseTests = false;
      return;
    }

    // Ensure clean state
    try {
      await supabase.auth.signOut();
      await supabase.auth.getSession();
    } catch {
      canRunSupabaseTests = false;
    }
  });

  afterAll(async () => {
    if (!canRunSupabaseTests) return;

    // Cleanup: delete test user if created
    if (testUserId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.log('Cleanup error (non-critical):', error);
      }
    }
  });

  describe('Signup Flow', () => {
    it('should create a new user account with trial subscription', async () => {
      if (!canRunSupabaseTests) return;

      const result = await signupWithTrial({
        email: testEmail,
        password: testPassword,
        name: 'Test User',
        phone: testPhone,
        dob: '1990-01-01',
        referralCode: '',
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmail);
      expect(result.error).toBeNull();
      
      testUserId = result.user.id;

      const session = await loginWithContext({
        email: testEmail,
        password: testPassword,
      });
      expect(session.subscription_status).toBeDefined();
    }, 30000);

    it('should prevent duplicate email registration', async () => {
      if (!canRunSupabaseTests) return;

      const duplicateResult = await signupWithTrial({
        email: testEmail,
        password: testPassword,
        name: 'Duplicate User',
        phone: '+19876543210',
        dob: '1990-01-01',
        referralCode: '',
      });

      expect(duplicateResult.user).toBeNull();
      expect(duplicateResult.error).toBeDefined();
      expect(String(duplicateResult.error?.message || '')).toMatch(/already registered|already exists/i);
    }, 30000);
  });

  describe('Login Flow', () => {
    it('should login with correct credentials', async () => {
      if (!canRunSupabaseTests) return;

      const session = await loginWithContext({
        email: testEmail,
        password: testPassword,
      });

      expect(session).toBeDefined();
      expect(session.user).toBeDefined();
      expect(session.user.email).toBe(testEmail);
      expect(session.subscription_status).toBeDefined();
    }, 30000);

    it('should reject login with incorrect password', async () => {
      if (!canRunSupabaseTests) return;

      await expect(
        loginWithContext({
          email: testEmail,
          password: 'WrongPassword123',
        })
      ).rejects.toThrow(/invalid|credentials/i);
    }, 30000);

    it('should reject login with non-existent email', async () => {
      if (!canRunSupabaseTests) return;

      await expect(
        loginWithContext({
          email: `nonexistent-${Date.now()}@example.com`,
          password: testPassword,
        })
      ).rejects.toThrow(/invalid|credentials|not found/i);
    }, 30000);
  });

  describe('Phone Verification Flow', () => {
    it('should send phone verification code', async () => {
      if (!canRunSupabaseTests) return;

      try {
        const result = await sendPhoneVerificationCode(testPhone);

        expect(result).toBeDefined();
        if (result.devBypass) {
          expect(result.devBypassCode).toBeDefined();
          expect(result.devBypassCode).toMatch(/^\d{6}$/);
        }
      } catch (error: any) {
        // Some environments do not have pgcrypto/twilio configured.
        expect(String(error?.message || '')).toMatch(
          /Failed to hash OTP|verification code|twilio|sms/i
        );
      }
    }, 30000);

    it('should verify phone code (dev bypass)', async () => {
      if (!canRunSupabaseTests) return;

      // This test assumes dev bypass mode is enabled
      // In production, you would use the actual SMS code
      let sendResult;
      try {
        sendResult = await sendPhoneVerificationCode(testPhone);
      } catch {
        return;
      }
      
      if (sendResult.devBypass && sendResult.devBypassCode) {
        await expect(
          verifyPhoneCode(testPhone, sendResult.devBypassCode)
        ).resolves.not.toThrow();
      } else {
        // Skip if not in dev bypass mode
        console.log('Skipping phone verification test (no dev bypass code)');
      }
    }, 30000);

    it('should reject invalid phone verification code', async () => {
      if (!canRunSupabaseTests) return;

      await expect(
        verifyPhoneCode(testPhone, '000000')
      ).rejects.toThrow(/invalid|expired|not found|not authenticated|verification failed/i);
    }, 30000);
  });

  describe('Password Reset Flow', () => {
    it('should send password reset email', async () => {
      if (!canRunSupabaseTests) return;

      const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
        redirectTo: 'p2pkidsmarketplace://reset-password',
      });

      // Note: This may fail in dev if SMTP is not configured
      // Error is acceptable in that case
      if (error) {
        console.log('Password reset email error (expected in dev):', error.message);
        expect(error.message).toMatch(/smtp|email|rate limit/i);
      } else {
        // Success case
        expect(error).toBeNull();
      }
    }, 30000);
  });

  describe('Session Management', () => {
    it('should retrieve current session after login', async () => {
      if (!canRunSupabaseTests) return;

      await loginWithContext({
        email: testEmail,
        password: testPassword,
      });

      const { data: { session }, error } = await supabase.auth.getSession();

      expect(error).toBeNull();
      expect(session).toBeDefined();
      expect(session?.user.email).toBe(testEmail);
    }, 30000);

    it('should logout and clear session', async () => {
      if (!canRunSupabaseTests) return;

      // First login
      await loginWithContext({
        email: testEmail,
        password: testPassword,
      });

      // Then logout
      const { error } = await supabase.auth.signOut();

      expect(error).toBeNull();

      // Verify session is cleared
      const { data: { session } } = await supabase.auth.getSession();
      expect(session).toBeNull();
    }, 30000);
  });

  describe('UI Design System Compliance (Integration)', () => {
    it('should use correct primary color (#5DBB8E) in theme', async () => {
      expect(theme.colors.primary[500]).toBe('#5DBB8E');
    });

    it('should use correct error color in theme', async () => {
      expect(theme.textColors.error).toBe('#E53935');
    });

    it('should use correct text colors in theme', async () => {
      expect(theme.textColors.primary).toBe('#1A1A1A');
      expect(theme.textColors.secondary).toBe('#4D4D4D');
      expect(theme.textColors.tertiary).toBe('#808080');
    });

    it('should use correct input styles in TextInput component', async () => {
      const { getByTestId } = render(
        React.createElement(TextInput, {
          testID: 'test-input',
          placeholder: 'Test',
        })
      );

      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            flex: 1,
            color: '#1A1A1A',
          }),
        ])
      );
      expect(input.props.placeholderTextColor).toBe(theme.colors.neutral[500]);
    });

    it('should use correct button styles in Button component', async () => {
      const { getByTestId } = render(
        React.createElement(Button, {
          testID: 'test-button',
          variant: 'primary',
          size: 'large',
          children: 'Test Button',
        })
      );

      const button = getByTestId('test-button');
      expect(button.props.style).toMatchObject({
        height: 52,
        borderRadius: 26,
        backgroundColor: '#5DBB8E',
      });
    });
  });
});
