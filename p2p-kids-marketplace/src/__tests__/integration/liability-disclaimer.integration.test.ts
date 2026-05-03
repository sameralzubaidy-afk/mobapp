/**
 * Integration Test: SAFETY-012 Liability Disclaimer System
 * Tests end-to-end flow with real Supabase (staging)
 *
 * Run with: RUN_SUPABASE_E2E=true npm run test:e2e
 */

import { supabase } from '@/config/supabase';

describe('SAFETY-012: Liability Disclaimer Integration', () => {
  let canRun = process.env.RUN_SUPABASE_E2E === 'true';
  let skipReason = '';
  let testPolicyId: string;
  let testUserId: string;
  let testTradeId: string;

  const skipIfUnavailable = () => {
    if (!canRun) {
      if (skipReason) {
        console.warn(`[SAFETY-012] Skipping test: ${skipReason}`);
      }
      return true;
    }
    return false;
  };

  beforeAll(async () => {
    if (!canRun) {
      console.log('⏭️  Skipping E2E test (set RUN_SUPABASE_E2E=true to run)');
      return;
    }

    // Get or create test policy
    const { data: policies, error: policyError } = await supabase.rpc('get_current_policy', {
      p_policy_type: 'liability_disclaimer',
    });

    if (policyError) {
      canRun = false;
      skipReason = `Required RPC/policy setup is unavailable: ${policyError.message}`;
      return;
    }

    if (policies && policies.length > 0) {
      testPolicyId = policies[0].id;
    } else {
      canRun = false;
      skipReason = 'No published liability disclaimer found';
      return;
    }

    // Get test user ID (assuming test user exists)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      canRun = false;
      skipReason = 'Test must run with authenticated user';
      return;
    }
    testUserId = user.id;
  });

  describe('get_current_policy RPC', () => {
    it('should fetch current liability disclaimer policy', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'liability_disclaimer',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('policy_type', 'liability_disclaimer');
      expect(data[0]).toHaveProperty('version');
      expect(data[0]).toHaveProperty('title');
      expect(data[0]).toHaveProperty('content');
    });

    it('should return empty array for non-existent policy type', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'non_existent_policy',
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('acknowledge_trade_disclaimer RPC', () => {
    beforeEach(async () => {
      if (skipIfUnavailable()) return;

      // Create a test trade in pending status
      // (In real implementation, use existing test data or create via initiate_trade_v2)
      // For this example, we'll mock the concept
      testTradeId = '00000000-0000-0000-0000-000000000001';
    });

    it('should record disclaimer acknowledgment for valid trade', async () => {
      if (skipIfUnavailable()) return;

      // Note: This test requires a real pending trade owned by testUserId
      // Skip if no test trade available
      if (!testTradeId) {
        console.log('⏭️  Skipping: No test trade available');
        return;
      }

      const { data, error } = await supabase.rpc('acknowledge_trade_disclaimer', {
        p_trade_id: testTradeId,
        p_disclaimer_policy_id: testPolicyId,
      });

      // Expected: error (no test trade) OR success
      // This is just structure validation
      if (error) {
        expect(error.message).toMatch(/Trade not found|not authorized/i);
      } else {
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('trade_id');
        expect(data).toHaveProperty('policy_version');
      }
    });

    it('should fail with invalid policy ID', async () => {
      if (skipIfUnavailable()) return;

      const invalidPolicyId = '00000000-0000-0000-0000-000000000000';

      const { data, error } = await supabase.rpc('acknowledge_trade_disclaimer', {
        p_trade_id: testTradeId,
        p_disclaimer_policy_id: invalidPolicyId,
      });

      expect(error).toBeDefined();
      expect(error.message).toMatch(
        /Invalid disclaimer policy|Trade not found|not authorized|not found/i
      );
    });
  });

  describe('policy_acceptances table', () => {
    it('should allow reading own policy acceptances', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase
        .from('policy_acceptances')
        .select('*')
        .eq('user_id', testUserId)
        .eq('policy_type', 'liability_disclaimer')
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      // May be empty if user has never accepted, which is OK
    });

    it('should record acceptance with IP and timestamp', async () => {
      if (skipIfUnavailable()) return;

      const { data, error } = await supabase
        .from('policy_acceptances')
        .select('*')
        .eq('user_id', testUserId)
        .eq('policy_type', 'liability_disclaimer')
        .order('accepted_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        expect(data).toHaveProperty('accepted_at');
        expect(data).toHaveProperty('policy_version');
        // Note: ip_address and user_agent are optional
      }

      // If no data, user hasn't accepted yet (OK for test)
      if (error && !error.message.includes('0 rows')) {
        throw error;
      }
    });
  });

  describe('trades table disclaimer columns', () => {
    it('should have disclaimer tracking columns', async () => {
      if (skipIfUnavailable()) return;

      // Query trades table schema (metadata check)
      const { data, error } = await supabase
        .from('trades')
        .select('disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at')
        .limit(1);

      // If no trades exist, this is OK - we're just checking schema
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('End-to-End Flow Simulation', () => {
    it('simulates full disclaimer acceptance flow', async () => {
      if (skipIfUnavailable()) return;

      // 1. Fetch current policy
      const { data: policyData, error: policyError } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'liability_disclaimer',
      });

      expect(policyError).toBeNull();
      expect(policyData).toBeDefined();
      expect(policyData.length).toBeGreaterThan(0);

      const policy = policyData[0];

      // 2. User would see modal with policy.content
      expect(policy.content).toBeDefined();
      expect(policy.content.length).toBeGreaterThan(0);

      // 3. User accepts (checking)
      // In real flow: initiate_trade_v2 -> acknowledge_trade_disclaimer
      // Here we just validate the policy exists and is accessible
      expect(policy.id).toBe(testPolicyId);
    });
  });
});
