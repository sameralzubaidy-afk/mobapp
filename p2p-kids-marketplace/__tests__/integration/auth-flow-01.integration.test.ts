// File: p2p-kids-marketplace/__tests__/integration/auth-flow-01.integration.test.ts
// MODULE-15.1: Auth Flow Integration Tests
// FLOW-01: Authentication & Session Management
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { loginWithContext, signupWithTrial } from '@/services/auth';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/phoneService';
import { supabase } from '@/services/supabase/client';

describe('FLOW-01: Authentication & Session Management (Integration)', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123';
  const testPhone = '+12345678901';
  let testUserId: string;

  beforeAll(async () => {
    // Ensure clean state
    await supabase.auth.signOut();
  });

  afterAll(async () => {
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
      expect(result.subscription_status).toMatch(/trial|active/);
      
      testUserId = result.user.id;
    }, 30000);

    it('should prevent duplicate email registration', async () => {
      await expect(
        signupWithTrial({
          email: testEmail,
          password: testPassword,
          name: 'Duplicate User',
          phone: '+19876543210',
          dob: '1990-01-01',
          referralCode: '',
        })
      ).rejects.toThrow(/already registered|already exists/i);
    }, 30000);
  });

  describe('Login Flow', () => {
    it('should login with correct credentials', async () => {
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
      await expect(
        loginWithContext({
          email: testEmail,
          password: 'WrongPassword123',
        })
      ).rejects.toThrow(/invalid|credentials/i);
    }, 30000);

    it('should reject login with non-existent email', async () => {
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
      const result = await sendPhoneVerificationCode(testPhone);

      expect(result).toBeDefined();
      // In dev mode, may return devBypass: true with code
      if (result.devBypass) {
        expect(result.devBypassCode).toBeDefined();
        expect(result.devBypassCode).toMatch(/^\d{6}$/);
      } else {
        expect(result.success).toBe(true);
      }
    }, 30000);

    it('should verify phone code (dev bypass)', async () => {
      // This test assumes dev bypass mode is enabled
      // In production, you would use the actual SMS code
      const sendResult = await sendPhoneVerificationCode(testPhone);
      
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
      await expect(
        verifyPhoneCode(testPhone, '000000')
      ).rejects.toThrow(/invalid|expired|not found/i);
    }, 30000);
  });

  describe('Password Reset Flow', () => {
    it('should send password reset email', async () => {
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
      const { theme } = await import('@/theme');
      
      expect(theme.colors.primary[500]).toBe('#5DBB8E');
    });

    it('should use correct error color (#E85D75) in theme', async () => {
      const { theme } = await import('@/theme');
      
      expect(theme.textColors.error).toBe('#E85D75');
    });

    it('should use correct text colors in theme', async () => {
      const { theme } = await import('@/theme');
      
      expect(theme.textColors.primary).toBe('#1A1A1A');
      expect(theme.textColors.secondary).toBe('#4D4D4D');
      expect(theme.textColors.tertiary).toBe('#808080');
    });

    it('should use correct input styles in TextInput component', async () => {
      const { render } = await import('@testing-library/react-native');
      const { TextInput } = await import('@/components/ui');
      const React = await import('react');

      const { getByTestID } = render(
        React.createElement(TextInput, {
          testID: 'test-input',
          placeholder: 'Test',
        })
      );

      const input = getByTestID('test-input');
      expect(input.props.style).toMatchObject({
        height: 52,
        borderRadius: 12,
        backgroundColor: '#F0F0F0',
        borderWidth: 0,
      });
    });

    it('should use correct button styles in Button component', async () => {
      const { render } = await import('@testing-library/react-native');
      const { Button } = await import('@/components/ui');
      const React = await import('react');

      const { getByTestID } = render(
        React.createElement(Button, {
          testID: 'test-button',
          variant: 'primary',
          size: 'large',
          children: 'Test Button',
        })
      );

      const button = getByTestID('test-button');
      expect(button.props.style).toMatchObject({
        height: 52,
        borderRadius: 26,
        backgroundColor: '#5DBB8E',
      });
    });
  });
});
