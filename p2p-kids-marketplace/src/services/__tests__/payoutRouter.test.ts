/**
 * Payout Router Unit Tests
 * File: p2p-kids-marketplace/src/services/__tests__/payoutRouter.test.ts
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import {
  calculatePayoutFeeCents,
  computeNetPayoutCents,
  getPayoutStatusMessage,
  formatPayoutAmount,
} from '../payoutRouter';

describe('payoutRouter', () => {
  describe('calculatePayoutFeeCents', () => {
    it('should calculate Stripe Connect fee correctly (0.25% + $0.25)', () => {
      // $100 = 10000 cents
      // Fee = (10000 * 0.0025) + 25 = 25 + 25 = 50 cents
      expect(calculatePayoutFeeCents('stripe_connect', 10000)).toBe(50);

      // $50 = 5000 cents
      // Fee = (5000 * 0.0025) + 25 = 12.5 + 25 = 37.5 -> 38 cents (rounded)
      expect(calculatePayoutFeeCents('stripe_connect', 5000)).toBe(38);
    });

    it('should calculate PayPal fee correctly (2% capped at $20)', () => {
      // $50 = 5000 cents
      // Fee = 5000 * 0.02 = 100 cents
      expect(calculatePayoutFeeCents('paypal', 5000)).toBe(100);

      // $10 = 1000 cents
      // Fee = 1000 * 0.02 = 20 cents
      expect(calculatePayoutFeeCents('paypal', 1000)).toBe(20);

      // $2000 = 200000 cents
      // Fee = 200000 * 0.02 = 4000 cents, capped at 2000 cents ($20)
      expect(calculatePayoutFeeCents('paypal', 200000)).toBe(2000);
    });

    it('should calculate Venmo fee correctly (same as PayPal)', () => {
      expect(calculatePayoutFeeCents('venmo', 5000)).toBe(100);
      expect(calculatePayoutFeeCents('venmo', 200000)).toBe(2000);
    });

    it('should return 25 cents for bank ACH', () => {
      expect(calculatePayoutFeeCents('bank_ach', 10000)).toBe(25);
    });

    it('should return 0 for zero or negative amounts', () => {
      expect(calculatePayoutFeeCents('stripe_connect', 0)).toBe(0);
      expect(calculatePayoutFeeCents('paypal', -100)).toBe(0);
    });
  });

  describe('computeNetPayoutCents', () => {
    it('should compute net payout correctly', () => {
      // Gross $100, platform fee $0, payout fee $2
      // Net = 10000 - 0 - 200 = 9800 cents
      expect(computeNetPayoutCents(10000, 0, 200)).toBe(9800);
    });

    it('should never return negative net amount', () => {
      // Gross $10, fees total $12
      expect(computeNetPayoutCents(1000, 500, 700)).toBe(0);
    });

    it('should handle zero platform fee (per policy)', () => {
      // Gross $50, platform fee $0, payout fee $1
      expect(computeNetPayoutCents(5000, 0, 100)).toBe(4900);
    });
  });

  describe('getPayoutStatusMessage', () => {
    it('should return correct message for requires_action', () => {
      const message = getPayoutStatusMessage('requires_action');
      expect(message).toContain('set up a payout method');
    });

    it('should return correct message for pending', () => {
      const message = getPayoutStatusMessage('pending');
      expect(message).toBe('Available to withdraw');
    });

    it('should return correct message for processing', () => {
      const message = getPayoutStatusMessage('processing');
      expect(message).toContain('Processing');
    });

    it('should return correct message for completed', () => {
      const message = getPayoutStatusMessage('completed');
      expect(message).toBe('Completed');
    });

    it('should return correct message for failed', () => {
      const message = getPayoutStatusMessage('failed');
      expect(message).toContain('Failed');
    });
  });

  describe('formatPayoutAmount', () => {
    it('should format cents to dollar amount correctly', () => {
      expect(formatPayoutAmount(10000)).toBe('100.00');
      expect(formatPayoutAmount(5050)).toBe('50.50');
      expect(formatPayoutAmount(99)).toBe('0.99');
      expect(formatPayoutAmount(0)).toBe('0.00');
    });
  });
});
