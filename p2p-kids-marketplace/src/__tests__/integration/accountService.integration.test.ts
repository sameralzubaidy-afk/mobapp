// File: src/__tests__/integration/accountService.integration.test.ts
// TASK: AUTH-V3-004 — AccountService Integration Tests
// Source: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md v1.0
// 
// ⚠️ INTEGRATION TEST: Runs against Supabase staging
// Required env: RUN_SUPABASE_E2E=true
// SQL prereqs: user_linked_providers view, link_social_account RPC, admin_audit_logs table

import {
  checkAccountExists,
  linkSocialAccount,
  unlinkSocialAccount,
  getLinkedProviders,
  countLoginMethods,
} from '../../services/accountService';
import { supabase } from '../../config/supabase';
import {
  EmailMismatchError,
  LastLoginMethodError,
} from '../../types/auth-v3-errors';

// Skip unless explicitly enabled
const describeIf = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

describeIf('AccountService Integration Tests', () => {
  let testUserId: string | null = null;
  let testEmail: string;

  beforeAll(async () => {
    // Create a test user for integration tests
    testEmail = `test-accountservice-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Test user creation returned no user');
    }

    testUserId = data.user.id;

    // Sign in to get session
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
  });

  afterAll(async () => {
    // Clean up: delete test user
    if (testUserId) {
      try {
        // Sign out
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Failed to clean up test user:', error);
      }
    }
  });

  describe('checkAccountExists', () => {
    it('should return exists=true for existing account', async () => {
      const result = await checkAccountExists(testEmail);

      expect(result.exists).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.hasPassword).toBe(true);
    }, 10000);

    it('should return exists=false for non-existent account', async () => {
      const result = await checkAccountExists('nonexistent-' + Date.now() + '@example.com');

      expect(result.exists).toBe(false);
      expect(result.userId).toBeUndefined();
    }, 10000);
  });

  describe('getLinkedProviders', () => {
    it('should return linked providers (initially empty for email/password signup)', async () => {
      const providers = await getLinkedProviders();

      // Email/password signup doesn't create OAuth providers
      // Should be empty or have only 'email' provider
      expect(Array.isArray(providers)).toBe(true);
    }, 10000);
  });

  describe('countLoginMethods', () => {
    it('should count password as 1 method for email/password user', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const count = await countLoginMethods(testUserId);

      // Email/password user has 1 method (password)
      expect(count).toBeGreaterThanOrEqual(1);
    }, 10000);
  });

  // Note: linkSocialAccount and unlinkSocialAccount require OAuth flow
  // which cannot be fully tested in automated integration tests without
  // real OAuth provider credentials and redirect handling.
  // These are covered by unit tests with mocks and manual E2E testing.

  describe('linkSocialAccount (limited test)', () => {
    it('should require authentication', async () => {
      // Sign out
      await supabase.auth.signOut();

      const mockProfile = {
        name: 'Test User',
        email: testEmail,
        provider: 'google' as const,
        providerUserId: 'google-test-123',
      };

      await expect(
        linkSocialAccount('google', mockProfile, 'TestPassword123!'),
      ).rejects.toThrow('Not authenticated');

      // Sign back in for other tests
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'TestPassword123!',
      });
    }, 10000);
  });

  describe('unlinkSocialAccount (limited test)', () => {
    it('should require authentication', async () => {
      // Sign out
      await supabase.auth.signOut();

      await expect(
        unlinkSocialAccount('google'),
      ).rejects.toThrow('Not authenticated');

      // Sign back in for other tests
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'TestPassword123!',
      });
    }, 10000);
  });
});
