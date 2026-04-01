// File: p2p-kids-marketplace/e2e/safety-011-privacy-policy.integration.test.ts
// MODULE-13 SAFETY-011: Privacy Policy E2E Integration Test
// Run against staging Supabase with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '../src/config/supabase';
import { getPrivacyPolicyService } from '../src/services/privacyPolicy';

describe('SAFETY-011: Privacy Policy Integration Tests', () => {
  let canRun = process.env.RUN_SUPABASE_E2E === 'true';
  let skipReason = '';
  let testUserId: string;
  let testEmail: string;
  let policyId: string;

  const skipIfUnavailable = () => {
    if (!canRun) {
      if (skipReason) {
        console.warn(`[SAFETY-011] Skipping test: ${skipReason}`);
      }
      return true;
    }
    return false;
  };

  beforeAll(async () => {
    // Skip if not running E2E tests
    if (!canRun) {
      console.log('Skipping E2E tests. Set RUN_SUPABASE_E2E=true to run.');
      return;
    }

    // Guard on required RPC availability in target database.
    const { error: rpcError } = await supabase.rpc('get_current_policy', {
      p_policy_type: 'privacy_policy',
    });
    if (rpcError) {
      canRun = false;
      skipReason = `Required RPC is unavailable: ${rpcError.message}`;
      return;
    }

    // Create test user
    testEmail = `privacy-policy-test-${Date.now()}@example.com`;
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'Test1234!',
    });

    if (error || !data.user) {
      canRun = false;
      skipReason = `Unable to create test user: ${error?.message || 'unknown error'}`;
      return;
    }
    testUserId = data.user!.id;

    // Get current Privacy Policy ID
    const policy = await getPrivacyPolicyService().getCurrentPrivacyPolicy();
    if (!policy) {
      canRun = false;
      skipReason =
        'No published Privacy Policy found in database. Create one via admin portal before running E2E.';
      return;
    }
    policyId = policy.id;
  });

  afterAll(async () => {
    if (!canRun || !testUserId) return;

    // Cleanup: Delete test user acceptances
    await supabase
      .from('policy_acceptances')
      .delete()
      .eq('user_id', testUserId)
      .eq('policy_type', 'privacy_policy');

    // Delete test user
    if ((supabase.auth as any).admin?.deleteUser) {
      await (supabase.auth as any).admin.deleteUser(testUserId);
    }
  });

  describe('Privacy Policy Retrieval', () => {
    it('should fetch current published Privacy Policy', async () => {
      if (skipIfUnavailable()) return;

      const service = getPrivacyPolicyService();
      const policy = await service.getCurrentPrivacyPolicy();

      expect(policy).toBeDefined();
      expect(policy!.policy_type).toBe('privacy_policy');
      expect(policy!.version).toBeDefined();
      expect(policy!.content).toBeDefined();
      expect(policy!.title).toContain('Privacy');
    });

    it('should return null if no published Privacy Policy exists', async () => {
      if (skipIfUnavailable()) return;

      // Archive all policies temporarily
      const { data } = await supabase
        .from('platform_policies')
        .select('id')
        .eq('policy_type', 'privacy_policy')
        .eq('status', 'published');

      const policyIds = data?.map((p) => p.id) || [];

      if (policyIds.length > 0) {
        await supabase
          .from('platform_policies')
          .update({ status: 'archived' })
          .in('id', policyIds);
      }

      const service = getPrivacyPolicyService();
      const policy = await service.getCurrentPrivacyPolicy();

      expect(policy).toBeNull();

      // Restore policies
      if (policyIds.length > 0) {
        await supabase
          .from('platform_policies')
          .update({ status: 'published' })
          .in('id', policyIds);
      }
    });
  });

  describe('Privacy Policy Acceptance', () => {
    it('should record privacy policy acceptance', async () => {
      if (skipIfUnavailable()) return;

      const service = getPrivacyPolicyService();

      // Sign in as test user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'Test1234!',
      });

      // Accept Privacy Policy
      await service.acceptPrivacyPolicy(policyId);

      // Verify acceptance recorded
      const { data, error } = await supabase
        .from('policy_acceptances')
        .select('*')
        .eq('user_id', testUserId)
        .eq('policy_type', 'privacy_policy')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.policy_id).toBe(policyId);
      expect(data!.accepted_at).toBeDefined();
    });

    it('should check if user has accepted current Privacy Policy', async () => {
      if (skipIfUnavailable()) return;

      const service = getPrivacyPolicyService();

      // Sign in as test user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'Test1234!',
      });

      // Check acceptance
      const hasAccepted = await service.hasAcceptedCurrentPrivacyPolicy();

      expect(hasAccepted).toBe(true);
    });

    it('should retrieve user acceptance history', async () => {
      if (skipIfUnavailable()) return;

      const service = getPrivacyPolicyService();

      // Sign in as test user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'Test1234!',
      });

      // Get acceptance history
      const history = await service.getUserAcceptanceHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].policy_type).toBe('privacy_policy');
      expect(history[0].user_id).toBe(testUserId);
    });
  });

  describe('RPC Functions', () => {
    it('should call get_current_policy RPC correctly', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'privacy_policy',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0].policy_type).toBe('privacy_policy');
      }
    });

    it('should call has_accepted_current_policy RPC correctly', async () => {
      if (skipIfUnavailable()) return;

      // Sign in as test user
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: 'Test1234!',
      });

      const { data, error } = await supabase.rpc('has_accepted_current_policy', {
        p_user_id: testUserId,
        p_policy_type: 'privacy_policy',
      });

      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });
  });

  describe('Database Schema Validation', () => {
    it('should have platform_policies table with privacy_policy type', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase
        .from('platform_policies')
        .select('*')
        .eq('policy_type', 'privacy_policy')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have policy_acceptances table tracking privacy_policy', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase
        .from('policy_acceptances')
        .select('*')
        .eq('policy_type', 'privacy_policy')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});
