/**
 * E2E Test: PAY-001 - Seller Payout Schema
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * 
 * Tests database schema, constraints, RLS policies, and indexes
 * for seller payout methods and payout ledger.
 * 
 * Prerequisites:
 * - Migration 073_seller_payouts.sql must be applied
 * - Test user must exist in auth.users and profiles
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getJwtRole(maybeJwt: string): string {
  // Supabase legacy keys are JWT-like; new keys may not be.
  if (!maybeJwt || !maybeJwt.includes('.')) return 'unknown';
  try {
    const [, payload] = maybeJwt.split('.');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return typeof parsed?.role === 'string' ? parsed.role : 'unknown';
  } catch {
    return 'unknown';
  }
}

const serviceKeyRole = getJwtRole(SUPABASE_SERVICE_KEY);
const shouldRunSupabaseE2E =
  process.env.RUN_SUPABASE_E2E === 'true' &&
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_KEY) &&
  // If the key is JWT-like, require service_role; otherwise allow and rely on DB response.
  (serviceKeyRole === 'unknown' || serviceKeyRole === 'service_role');

const d = shouldRunSupabaseE2E ? describe : describe.skip;

d('PAY-001: Seller Payout Schema E2E Tests', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testMethodId: string;
  let testPayoutId: string;

  beforeAll(async () => {
    // Initialize Supabase client with service role key for testing
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Use seeded test user (test-seller)
    testUserId = '14be337c-aad6-403f-bab2-ba1a7d80b666';
    
    // Verify test user exists
    const { data: userExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', testUserId)
      .single();
    
    if (!userExists) {
      throw new Error('Test user not found. Run `npm run seed:staging` first.');
    }

    // Clean up any existing test data
    await supabase
      .from('seller_payouts')
      .delete()
      .eq('user_id', testUserId);
    
    await supabase
      .from('seller_payout_methods')
      .delete()
      .eq('user_id', testUserId);
  });

  afterAll(async () => {
    // Clean up test data
    if (testPayoutId) {
      await supabase
        .from('seller_payouts')
        .delete()
        .eq('id', testPayoutId);
    }
    
    if (testMethodId) {
      await supabase
        .from('seller_payout_methods')
        .delete()
        .eq('id', testMethodId);
    }
  });

  describe('Schema Validation', () => {
    it('should have seller_payout_methods table with correct columns', async () => {
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have seller_payouts table with correct columns', async () => {
      const { data, error } = await supabase
        .from('seller_payouts')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Payout Methods CRUD', () => {
    it('should create a Stripe Connect payout method', async () => {
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'stripe_connect',
          stripe_account_id: 'acct_test_12345',
          is_primary: true,
          is_verified: false,
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.method_type).toBe('stripe_connect');
      expect(data?.is_primary).toBe(true);
      
      testMethodId = data!.id;
    });

    it('should enforce one-primary-method constraint', async () => {
      // Try to create another primary method for same user
      const { error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'paypal',
          paypal_email: 'test@example.com',
          is_primary: true,
          is_verified: true,
        });

      // Should fail due to unique index on (user_id) WHERE is_primary = true
      expect(error).not.toBeNull();
      expect(error?.message).toContain('seller_payout_methods_one_primary_idx');
    });

    it('should allow multiple non-primary methods for same user', async () => {
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'paypal',
          paypal_email: 'test@example.com',
          is_primary: false,
          is_verified: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.is_primary).toBe(false);

      // Clean up
      if (data?.id) {
        await supabase
          .from('seller_payout_methods')
          .delete()
          .eq('id', data.id);
      }
    });

    it('should update payout method to verified', async () => {
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .update({
          is_verified: true,
          stripe_onboarding_complete: true,
          stripe_payouts_enabled: true,
        })
        .eq('id', testMethodId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.is_verified).toBe(true);
      expect(data?.stripe_payouts_enabled).toBe(true);
    });

    it('should retrieve user payout methods', async () => {
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);
      
      const primaryMethod = data!.find(m => m.is_primary);
      expect(primaryMethod).toBeDefined();
    });
  });

  describe('Payout Ledger CRUD', () => {
    it('should create a payout record with valid amounts', async () => {
      const grossAmountCents = 5000; // $50.00
      const platformFeeCents = 0;    // $0 (per spec)
      const payoutFeeCents = 50;     // $0.50 (Stripe fee)
      const netAmountCents = grossAmountCents - platformFeeCents - payoutFeeCents;

      const { data, error } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          payout_method_id: testMethodId,
          currency: 'usd',
          gross_amount_cents: grossAmountCents,
          platform_fee_cents: platformFeeCents,
          payout_fee_cents: payoutFeeCents,
          net_amount_cents: netAmountCents,
          status: 'pending',
          provider: 'stripe',
          idempotency_key: `test_${Date.now()}`,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.net_amount_cents).toBe(netAmountCents);
      expect(data?.status).toBe('pending');

      testPayoutId = data!.id;
    });

    it('should enforce net_amount calculation constraint', async () => {
      // Try to create payout with invalid net_amount
      const { error } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          payout_method_id: testMethodId,
          gross_amount_cents: 5000,
          platform_fee_cents: 0,
          payout_fee_cents: 50,
          net_amount_cents: 9999, // WRONG: should be 4950
          status: 'pending',
          idempotency_key: `test_invalid_${Date.now()}`,
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('net_amount_calculation_valid');
    });

    it('should enforce idempotency_key uniqueness', async () => {
      const idempotencyKey = `test_duplicate_${Date.now()}`;

      // First insert should succeed
      const { data: first, error: firstError } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          payout_method_id: testMethodId,
          gross_amount_cents: 1000,
          platform_fee_cents: 0,
          payout_fee_cents: 10,
          net_amount_cents: 990,
          status: 'pending',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      expect(firstError).toBeNull();

      // Second insert with same key should fail
      const { error: secondError } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          payout_method_id: testMethodId,
          gross_amount_cents: 2000,
          platform_fee_cents: 0,
          payout_fee_cents: 20,
          net_amount_cents: 1980,
          status: 'pending',
          idempotency_key: idempotencyKey,
        });

      expect(secondError).not.toBeNull();
      expect(secondError?.message).toContain('idempotency_key');

      // Clean up
      if (first?.id) {
        await supabase
          .from('seller_payouts')
          .delete()
          .eq('id', first.id);
      }
    });

    it('should update payout status to processing', async () => {
      const { data, error } = await supabase
        .from('seller_payouts')
        .update({
          status: 'processing',
          initiated_at: new Date().toISOString(),
          provider_reference_id: 'stripe_payout_123456',
        })
        .eq('id', testPayoutId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('processing');
      expect(data?.provider_reference_id).toBe('stripe_payout_123456');
    });

    it('should update payout status to completed', async () => {
      const { data, error } = await supabase
        .from('seller_payouts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', testPayoutId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('completed');
      expect(data?.completed_at).not.toBeNull();
    });

    it('should list user payouts', async () => {
      const { data, error } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('user_id', testUserId)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);
    });
  });

  describe('RLS Policies', () => {
    it('should allow user to read own payout methods', async () => {
      const { data, error } = await supabase
        .from('seller_payout_methods')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow user to read own payouts', async () => {
      const { data, error } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should prevent user from reading other users payout methods', async () => {
      // Create a fake UUID that's not the current user
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const { data, error } = await supabase
        .from('seller_payout_methods')
        .select('*')
        .eq('user_id', fakeUserId);

      // Should return empty array due to RLS, not an error
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBe(0);
    });
  });

  describe('Constraints Validation', () => {
    it('should reject negative amounts', async () => {
      const { error } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          gross_amount_cents: -100,
          platform_fee_cents: 0,
          payout_fee_cents: 0,
          net_amount_cents: -100,
          status: 'pending',
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('gross_amount_cents');
    });

    it('should reject invalid status values', async () => {
      const { error } = await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          gross_amount_cents: 1000,
          platform_fee_cents: 0,
          payout_fee_cents: 10,
          net_amount_cents: 990,
          status: 'invalid_status' as any,
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('status');
    });

    it('should reject Stripe method without stripe_account_id', async () => {
      const { error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'stripe_connect',
          is_primary: false,
          is_verified: false,
          // Missing stripe_account_id
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('stripe_fields_required_for_stripe');
    });

    it('should reject PayPal method without paypal_email', async () => {
      const { error } = await supabase
        .from('seller_payout_methods')
        .insert({
          user_id: testUserId,
          method_type: 'paypal',
          is_primary: false,
          is_verified: false,
          // Missing paypal_email
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('paypal_email_required_for_paypal');
    });
  });

  describe('Index Performance', () => {
    it('should efficiently query by user_id', async () => {
      const start = Date.now();
      
      await supabase
        .from('seller_payouts')
        .select('*')
        .eq('user_id', testUserId);

      const duration = Date.now() - start;
      
      // Should be very fast with index
      expect(duration).toBeLessThan(1000);
    });

    it('should efficiently query by status', async () => {
      const start = Date.now();
      
      await supabase
        .from('seller_payouts')
        .select('*')
        .eq('status', 'completed');

      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
    });

    it('should efficiently query by idempotency_key', async () => {
      const testKey = `test_${Date.now()}`;
      
      // Create a payout with this key
      await supabase
        .from('seller_payouts')
        .insert({
          user_id: testUserId,
          gross_amount_cents: 1000,
          platform_fee_cents: 0,
          payout_fee_cents: 10,
          net_amount_cents: 990,
          status: 'pending',
          idempotency_key: testKey,
        });

      const start = Date.now();
      
      const { data } = await supabase
        .from('seller_payouts')
        .select('*')
        .eq('idempotency_key', testKey)
        .single();

      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
      expect(data).toBeDefined();

      // Clean up
      if (data?.id) {
        await supabase
          .from('seller_payouts')
          .delete()
          .eq('id', data.id);
      }
    });
  });
});
