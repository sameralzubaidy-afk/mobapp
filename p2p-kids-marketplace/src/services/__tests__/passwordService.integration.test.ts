// File: p2p-kids-marketplace/src/services/__tests__/passwordService.integration.test.ts
// Integration tests for passwordService against real Supabase (AUTH-V3-006)
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { canSetPassword, setPasswordForSocialUser } from '../passwordService';
import { supabase } from '../supabase/client';

// Skip if not in E2E mode
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

describeE2E('passwordService Integration Tests', () => {
  let testUserId: string;
  let canRunSuite = true;
  let skipReason = '';

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(`[passwordService.integration] Skipping assertion: ${skipReason}`);
      return true;
    }
    return false;
  };

  beforeAll(async () => {
    // Prefer an existing session; fall back to test credentials when provided.
    const { data, error } = await supabase.auth.getUser();
    let user = data.user;

    if ((!user || error) && process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
      const signIn = await supabase.auth.signInWithPassword({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      });

      if (!signIn.error) {
        const current = await supabase.auth.getUser();
        user = current.data.user;
      }
    }

    if (!user) {
      canRunSuite = false;
      skipReason =
        'Missing authenticated session. Set TEST_USER_EMAIL and TEST_USER_PASSWORD or sign in before running RUN_SUPABASE_E2E tests.';
      console.warn(`[passwordService.integration] ${skipReason}`);
      return;
    }

    testUserId = user.id;
  });

  afterAll(async () => {
    if (!canRunSuite) {
      return;
    }

    await supabase.auth.signOut();
  });

  describe('canSetPassword', () => {
    it('should check via RPC if user can set password', async () => {
      if (shouldSkipCase()) return;

      const result = await canSetPassword(testUserId);

      // Result depends on whether user has password set
      expect(typeof result).toBe('boolean');
    });
  });

  describe('setPasswordForSocialUser', () => {
    it('should reject weak password', async () => {
      if (shouldSkipCase()) return;

      const result = await setPasswordForSocialUser('weak');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject common password', async () => {
      if (shouldSkipCase()) return;

      const result = await setPasswordForSocialUser('password123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('common');
    });

    // Note: Testing actual password setting requires a social-only account
    // Skip if user already has password
    it.skip('should set password for social user', async () => {
      const canSet = await canSetPassword(testUserId);

      if (!canSet) {
        console.log('User already has password, skipping set password test');
        return;
      }

      const result = await setPasswordForSocialUser('MyNewSecurePass123!');

      expect(result.success).toBe(true);
    });
  });
});
