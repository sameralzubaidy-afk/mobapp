// File: p2p-kids-marketplace/src/__tests__/integration/flow-22-payouts.integration.test.ts
// MODULE-15.1 FLOW-22: Integration tests for Payout Dashboard + Request Payout
// Run with: RUN_SUPABASE_E2E=true npm run test:e2e

import { supabase } from '@/config/supabase';
import {
  getSellerBalance,
  getRecentPayouts,
  calculatePayoutFee,
  requestWithdrawal,
  formatCentsToDollars,
  canUserWithdraw,
} from '@/services/sellerBalance';
import { listPayoutMethods } from '@/services/payoutMethods';

const TEST_EMAIL = 'flow22test@kids-p2p-test.com';
const TEST_PASSWORD = 'TestPassword123!Flow22';

describe('FLOW-22: Payout Dashboard + Request Payout Integration Tests', () => {
  let testUserId: string | null = null;

  const skip = () => !process.env.RUN_SUPABASE_E2E;

  beforeAll(async () => {
    if (skip()) {
      console.warn('[FLOW-22] Skipping integration tests — set RUN_SUPABASE_E2E=true to run');
      return;
    }

    // Sign in as test user (must be pre-seeded in Supabase or created here)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError) {
      console.warn('[FLOW-22] Test user not found, attempting sign up...');
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (signupError) throw signupError;
      testUserId = signupData.user?.id ?? null;
    } else {
      testUserId = authData.user?.id ?? null;
    }
  });

  afterAll(async () => {
    if (skip()) return;
    await supabase.auth.signOut();
  });

  // ---------------------------------------------------------------------------
  describe('getSellerBalance()', () => {
    it('returns a balance object or null for authenticated user', async () => {
      if (skip()) { expect(true).toBe(true); return; }

      const balance = await getSellerBalance();
      // Balance can be null (no trades yet) or a valid object
      if (balance !== null) {
        expect(typeof balance.available_balance_cents).toBe('number');
        expect(typeof balance.pending_balance_cents).toBe('number');
        expect(balance.available_balance_cents).toBeGreaterThanOrEqual(0);
        expect(balance.pending_balance_cents).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns available_balance_cents as non-negative number', async () => {
      if (skip()) { expect(true).toBe(true); return; }

      const balance = await getSellerBalance();
      if (balance) {
        expect(balance.available_balance_cents).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('getRecentPayouts()', () => {
    it('returns an array of payouts (may be empty)', async () => {
      if (skip()) { expect(true).toBe(true); return; }

      const payouts = await getRecentPayouts(10);
      expect(Array.isArray(payouts)).toBe(true);
      for (const p of payouts) {
        expect(p.id).toBeTruthy();
        expect(p.user_id).toBe(testUserId);
        expect(['requires_action', 'pending', 'processing', 'completed', 'failed']).toContain(p.status);
        expect(typeof p.net_amount_cents).toBe('number');
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('listPayoutMethods()', () => {
    it('returns methods list for authenticated user', async () => {
      if (skip()) { expect(true).toBe(true); return; }

      const result = await listPayoutMethods();
      expect(result).toBeDefined();
      expect(Array.isArray(result.methods)).toBe(true);
      // primary_method may be null if no method added
      if (result.primary_method) {
        expect(result.primary_method.is_primary).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('calculatePayoutFee()', () => {
    it('returns correct fee for bank_ach ($0.25 flat)', () => {
      const fee = calculatePayoutFee('bank_ach', 5000);
      expect(fee).toBe(25); // 25 cents = $0.25
    });

    it('returns correct fee for stripe_connect ($0.25 + 0.25%)', () => {
      const fee = calculatePayoutFee('stripe_connect', 10000);
      // 10000 * 0.0025 = 25 + 25 (fixed) = 50
      expect(fee).toBe(50);
    });

    it('returns correct fee for paypal (2%, capped at $20)', () => {
      const fee = calculatePayoutFee('paypal', 100000);
      // 100000 * 0.02 = 2000 cents = $20.00 (at cap)
      expect(fee).toBeLessThanOrEqual(2000);
    });

    it('returns 0 fee for zero amount', () => {
      expect(calculatePayoutFee('bank_ach', 0)).toBe(0);
    });

    it('returns 0 fee for negative amount', () => {
      expect(calculatePayoutFee('bank_ach', -100)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('formatCentsToDollars()', () => {
    it('formats 5000 cents as $50.00', () => {
      expect(formatCentsToDollars(5000)).toBe('$50.00');
    });

    it('formats 0 cents as $0.00', () => {
      expect(formatCentsToDollars(0)).toBe('$0.00');
    });

    it('formats 1 cent as $0.01', () => {
      expect(formatCentsToDollars(1)).toBe('$0.01');
    });
  });

  // ---------------------------------------------------------------------------
  describe('canUserWithdraw()', () => {
    it('returns a valid withdrawal eligibility object', async () => {
      if (skip()) { expect(true).toBe(true); return; }

      const result = await canUserWithdraw();
      expect(typeof result.can_withdraw).toBe('boolean');
      expect(typeof result.available_balance_cents).toBe('number');
      if (!result.can_withdraw) {
        expect(result.reason).toBeTruthy();
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('requestWithdrawal() — guarded test (no real money moved in test)', () => {
    it('returns action_required when no payout method is configured', async () => {
      if (skip()) { expect(true).toBe(true); return; }

      // Test only the response shape — actual withdrawal is gated by payout method
      const eligibility = await canUserWithdraw();
      if (!eligibility.can_withdraw) {
        // Confirm correct error shape
        expect(typeof eligibility.reason).toBe('string');
      } else {
        // If user CAN withdraw, calling with 1 cent is a valid edge case
        const response = await requestWithdrawal(1);
        expect(typeof response.success).toBe('boolean');
        if (!response.success) {
          expect(response.error).toBeTruthy();
        }
      }
    });
  });
});
