/**
 * E2E Tests for Payout Integration (PAY-004, PAY-005)
 * File: p2p-kids-marketplace/src/__tests__/e2e/payout-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('Payout Integration E2E Tests', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testMethodId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create test user (or use existing test user)
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'test-seller@example.com')
      .maybeSingle();

    if (user) {
      testUserId = user.id;
    } else {
      // Skip tests if test user doesn't exist
      console.warn('Test user not found, skipping payout integration tests');
      testUserId = '';
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test payout methods
    if (testMethodId) {
      await supabase
        .from('seller_payout_methods')
        .delete()
        .eq('id', testMethodId);
    }
  });

  describe('Payout Method Management', () => {
    it('should add PayPal payout method', async () => {
      if (!testUserId) {
        console.warn('Skipping test: no test user');
        return;
      }

      const { data, error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'paypal',
          paypal_email: 'test-paypal@example.com',
          is_primary: false,
          is_verified: false,
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.method_type).toBe('paypal');
      expect(data?.paypal_email).toBe('test-paypal@example.com');

      if (data) {
        testMethodId = data.id;
      }
    });

    it('should add Venmo payout method', async () => {
      if (!testUserId) {
        console.warn('Skipping test: no test user');
        return;
      }

      const { data, error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'venmo',
          venmo_handle: '@test-venmo',
          is_primary: false,
          is_verified: false,
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.method_type).toBe('venmo');
      expect(data?.venmo_handle).toBe('@test-venmo');

      // Cleanup
      if (data) {
        await supabase
          .from('seller_payout_methods')
          .delete()
          .eq('id', data.id);
      }
    });

    it('should enforce unique primary method per user', async () => {
      if (!testUserId || !testMethodId) {
        console.warn('Skipping test: missing prerequisites');
        return;
      }

      // Mark first method as verified and primary
      await supabase
        .from('seller_payout_methods')
        .update({ is_verified: true, is_primary: true })
        .eq('id', testMethodId);

      // Try to create another primary method (should fail due to unique index)
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'paypal',
          paypal_email: 'another-paypal@example.com',
          is_primary: true,
          is_verified: true,
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false
        })
        .select()
        .single();

      // Should fail due to unique constraint
      expect(error).toBeDefined();
      expect(error?.code).toBe('23505'); // Unique violation
    });

    it('should use RPC to set primary method atomically', async () => {
      if (!testUserId || !testMethodId) {
        console.warn('Skipping test: missing prerequisites');
        return;
      }

      // Ensure method is verified
      await supabase
        .from('seller_payout_methods')
        .update({ is_verified: true })
        .eq('id', testMethodId);

      // Use RPC to set primary
      const { error } = await supabase.rpc('set_primary_payout_method', {
        p_user_id: testUserId,
        p_method_id: testMethodId
      });

      expect(error).toBeNull();

      // Verify it's now primary
      const { data } = await supabase
        .from('seller_payout_methods')
        .select('is_primary')
        .eq('id', testMethodId)
        .single();

      expect(data?.is_primary).toBe(true);
    });
  });

  describe('Payout Record Creation (Idempotency)', () => {
    it('should create payout record idempotently', async () => {
      if (!testUserId) {
        console.warn('Skipping test: no test user');
        return;
      }

      const idempotencyKey = `test-payout-${Date.now()}`;

      // Create first payout
      const { data: payout1, error: error1 } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          currency: 'usd',
          gross_amount: 10000,
          platform_fee: 0,
          payout_fee: 50,
          net_amount: 9950,
          status: 'pending',
          idempotency_key: idempotencyKey
        })
        .select()
        .single();

      expect(error1).toBeNull();
      expect(payout1).toBeDefined();

      // Try to create duplicate (should fail due to unique idempotency_key)
      const { data: payout2, error: error2 } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          currency: 'usd',
          gross_amount: 10000,
          platform_fee: 0,
          payout_fee: 50,
          net_amount: 9950,
          status: 'pending',
          idempotency_key: idempotencyKey
        })
        .select()
        .single();

      expect(error2).toBeDefined();
      expect(error2?.code).toBe('23505'); // Unique violation

      // Cleanup
      if (payout1) {
        await supabase
          .from('seller_payouts')
          .delete()
          .eq('id', payout1.id);
      }
    });
  });

  describe('Payout Status Transitions', () => {
    it('should transition payout from pending → processing → completed', async () => {
      if (!testUserId) {
        console.warn('Skipping test: no test user');
        return;
      }

      // Create payout in pending status
      const { data: payout, error: createError } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          currency: 'usd',
          gross_amount: 5000,
          platform_fee: 0,
          payout_fee: 100,
          net_amount: 4900,
          status: 'pending'
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(payout?.status).toBe('pending');

      // Transition to processing
      const { error: processingError } = await supabase
        .from('seller_payouts')
        .update({
          status: 'processing',
          initiated_at: new Date().toISOString()
        })
        .eq('id', payout!.id);

      expect(processingError).toBeNull();

      // Transition to completed
      const { error: completedError } = await supabase
        .from('seller_payouts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', payout!.id);

      expect(completedError).toBeNull();

      // Verify final status
      const { data: finalPayout } = await supabase
        .from('seller_payouts')
        .select('status, completed_at')
        .eq('id', payout!.id)
        .single();

      expect(finalPayout?.status).toBe('completed');
      expect(finalPayout?.completed_at).toBeDefined();

      // Cleanup
      if (payout) {
        await supabase
          .from('seller_payouts')
          .delete()
          .eq('id', payout.id);
      }
    });
  });
});
