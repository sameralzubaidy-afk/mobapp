// File: src/services/__tests__/oauthService.integration.test.ts
// Integration tests for OAuth Service (AUTH-V3-003)
// MODULE: MODULE-03-AUTH-V3-SOCIAL-LOGIN
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '../supabase/client';
import { isProviderLinked } from '../oauthService';

// Skip if not in E2E mode
const describeE2E = process.env.RUN_SUPABASE_E2E === 'true' ? describe : describe.skip;

describeE2E('OAuthService Integration Tests', () => {
  describe('isProviderLinked', () => {
    it('should query user_linked_providers view successfully', async () => {
      // This test verifies the view exists and is queryable
      // We don't need an actual linked provider - just verify the query works

      // Use a test user ID (this will return false but should not error)
      const testUserId = '00000000-0000-0000-0000-000000000000';

      const result = await isProviderLinked(testUserId, 'google');

      // Should return false for non-existent user, not throw error
      expect(result).toBe(false);
    });

    it('should handle different providers correctly', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000000';

      const googleResult = await isProviderLinked(testUserId, 'google');
      const facebookResult = await isProviderLinked(testUserId, 'facebook');
      const appleResult = await isProviderLinked(testUserId, 'apple');

      // All should return false for non-existent user
      expect(googleResult).toBe(false);
      expect(facebookResult).toBe(false);
      expect(appleResult).toBe(false);
    });
  });

  describe('Supabase Auth OAuth Configuration', () => {
    it('should have OAuth providers configured in Supabase', async () => {
      // Note: This test documents expected configuration
      // Actual provider enablement must be done manually in Supabase Dashboard

      // We can verify that signInWithOAuth exists and doesn't throw immediately
      const authMethods = supabase.auth.signInWithOAuth;
      expect(authMethods).toBeDefined();
      expect(typeof authMethods).toBe('function');
    });
  });

  describe('Database Schema Validation', () => {
    it('should have user_linked_providers view available', async () => {
      // Verify the view exists by attempting to query it
      const { error } = await supabase.from('user_linked_providers').select('provider').limit(0);

      // Should not error - view should exist even if empty
      expect(error).toBeNull();
    });
  });
});

/**
 * Manual verification steps (cannot be automated):
 *
 * 1. Supabase Dashboard → Authentication → Providers
 *    - Verify Google provider is enabled
 *    - Verify Facebook provider is enabled
 *    - Verify Apple provider is enabled
 *
 * 2. Verify OAuth redirect URIs are configured:
 *    - p2pkidsmarketplace://oauth-callback
 *
 * 3. Verify native SDK configurations:
 *    - iOS: expo-apple-authentication configured
 *    - Android: Google Services JSON present
 *    - Both: Facebook SDK configured
 *
 * These steps must be completed before manual testing.
 */
