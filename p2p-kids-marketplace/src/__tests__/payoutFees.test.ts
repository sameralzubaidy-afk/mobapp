/**
 * Unit Tests for Payout Fee Calculations (PAY-002)
 * File: p2p-kids-marketplace/src/__tests__/payoutFees.test.ts
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Calculate payout fee in cents based on method type
 */
export function getPayoutFeeCents(
  methodType: 'stripe_connect' | 'paypal' | 'venmo' | 'bank_ach',
  amountCents: number
): number {
  if (amountCents <= 0) return 0;

  switch (methodType) {
    case 'stripe_connect': {
      // 0.25% + $0.25
      return Math.round(amountCents * 0.0025) + 25;
    }
    case 'paypal':
    case 'venmo': {
      // 2% capped at $20
      return Math.min(Math.round(amountCents * 0.02), 2000);
    }
    case 'bank_ach': {
      // Post-MVP; placeholder
      return 25;
    }
    default:
      return 0;
  }
}

/**
 * Calculate net payout amount
 */
export function computeNetPayoutCents(
  grossCents: number,
  platformFeeCents: number,
  payoutFeeCents: number
): number {
  return Math.max(0, grossCents - platformFeeCents - payoutFeeCents);
}

describe('Payout Fee Calculations', () => {
  describe('getPayoutFeeCents', () => {
    it('should calculate Stripe Connect fee correctly (0.25% + $0.25)', () => {
      // $100 item
      const fee = getPayoutFeeCents('stripe_connect', 10000);
      expect(fee).toBe(25 + 25); // $0.25% of $100 = $0.25, plus $0.25 fixed = $0.50
    });

    it('should calculate Stripe Connect fee for small amounts', () => {
      // $10 item
      const fee = getPayoutFeeCents('stripe_connect', 1000);
      expect(fee).toBe(3 + 25); // $0.25% of $10 ≈ $0.03, plus $0.25 fixed = $0.28
    });

    it('should calculate PayPal fee as 2%', () => {
      // $50 item
      const fee = getPayoutFeeCents('paypal', 5000);
      expect(fee).toBe(100); // 2% of $50 = $1.00
    });

    it('should cap PayPal fee at $20', () => {
      // $2000 item (fee would be $40 without cap)
      const fee = getPayoutFeeCents('paypal', 200000);
      expect(fee).toBe(2000); // Capped at $20
    });

    it('should calculate Venmo fee same as PayPal', () => {
      // $75 item
      const fee = getPayoutFeeCents('venmo', 7500);
      expect(fee).toBe(150); // 2% of $75 = $1.50
    });

    it('should cap Venmo fee at $20', () => {
      // $1500 item (fee would be $30 without cap)
      const fee = getPayoutFeeCents('venmo', 150000);
      expect(fee).toBe(2000); // Capped at $20
    });

    it('should return 0 for zero amount', () => {
      expect(getPayoutFeeCents('stripe_connect', 0)).toBe(0);
      expect(getPayoutFeeCents('paypal', 0)).toBe(0);
    });

    it('should return 0 for negative amount', () => {
      expect(getPayoutFeeCents('stripe_connect', -100)).toBe(0);
      expect(getPayoutFeeCents('paypal', -100)).toBe(0);
    });
  });

  describe('computeNetPayoutCents', () => {
    it('should calculate net payout correctly', () => {
      const gross = 10000; // $100
      const platformFee = 0; // $0 (platform policy)
      const payoutFee = 50; // $0.50

      const net = computeNetPayoutCents(gross, platformFee, payoutFee);
      expect(net).toBe(9950); // $99.50
    });

    it('should handle platform fee if present', () => {
      const gross = 10000; // $100
      const platformFee = 99; // $0.99 (hypothetical)
      const payoutFee = 50; // $0.50

      const net = computeNetPayoutCents(gross, platformFee, payoutFee);
      expect(net).toBe(9851); // $98.51
    });

    it('should never return negative net amount', () => {
      const gross = 100;
      const platformFee = 50;
      const payoutFee = 100; // Total fees exceed gross

      const net = computeNetPayoutCents(gross, platformFee, payoutFee);
      expect(net).toBe(0); // Floored at 0
    });

    it('should handle zero fees', () => {
      const gross = 5000;
      const net = computeNetPayoutCents(gross, 0, 0);
      expect(net).toBe(5000);
    });
  });

  describe('Real-world scenarios', () => {
    it('Scenario 1: $50 item sold with Stripe payout', () => {
      const itemPrice = 5000; // $50
      const platformFee = 0; // $0
      const payoutFee = getPayoutFeeCents('stripe_connect', itemPrice);
      
      expect(payoutFee).toBe(13 + 25); // $0.13 + $0.25 = $0.38
      
      const net = computeNetPayoutCents(itemPrice, platformFee, payoutFee);
      expect(net).toBe(4962); // $49.62
    });

    it('Scenario 2: $200 item sold with PayPal payout', () => {
      const itemPrice = 20000; // $200
      const platformFee = 0;
      const payoutFee = getPayoutFeeCents('paypal', itemPrice);
      
      expect(payoutFee).toBe(400); // 2% = $4.00
      
      const net = computeNetPayoutCents(itemPrice, platformFee, payoutFee);
      expect(net).toBe(19600); // $196.00
    });

    it('Scenario 3: $1500 item sold with Venmo payout (cap applies)', () => {
      const itemPrice = 150000; // $1500
      const platformFee = 0;
      const payoutFee = getPayoutFeeCents('venmo', itemPrice);
      
      expect(payoutFee).toBe(2000); // Capped at $20.00
      
      const net = computeNetPayoutCents(itemPrice, platformFee, payoutFee);
      expect(net).toBe(148000); // $1480.00
    });
  });
});
