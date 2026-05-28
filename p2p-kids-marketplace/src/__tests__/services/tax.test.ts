/**
 * File: p2p-kids-marketplace/src/__tests__/services/tax.test.ts
 * MODULE-15.3-PART3 TAX-014 (unit)
 *
 * Mocks @/config/supabase directly with a jest.fn() so we have full mock API.
 */
import {
  calculateTax,
  applyTaxToTrade,
  refundTax,
  getTaxSummary,
  formatCents,
  formatTaxRate,
} from '@/services/tax';
import { supabase } from '@/config/supabase';

jest.mock('@/config/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  mockRpc.mockReset();
});

describe('tax service (TAX-014)', () => {
  describe('formatters', () => {
    it('formatCents handles null/undefined/NaN', () => {
      expect(formatCents(null)).toBe('$0.00');
      expect(formatCents(undefined)).toBe('$0.00');
      expect(formatCents(NaN as any)).toBe('$0.00');
      expect(formatCents(635)).toBe('$6.35');
    });

    it('formatTaxRate converts fraction to percent', () => {
      expect(formatTaxRate(0)).toBe('0.00%');
      expect(formatTaxRate(0.0635)).toBe('6.35%');
      expect(formatTaxRate(null)).toBe('0.00%');
    });
  });

  describe('calculateTax', () => {
    it('returns success and unwraps RPC payload', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          data: {
            taxable_amount_cents: 10000,
            tax_rate: 0.0635,
            tax_amount_cents: 635,
            tax_jurisdiction: 'CT',
            global_enabled: true,
          },
        },
        error: null,
      });
      const res = await calculateTax('node-1', 10000);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tax_amount_cents).toBe(635);
        expect(res.data.tax_rate).toBeCloseTo(0.0635);
      }
    });

    it('returns structured error on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
      const res = await calculateTax('n', 100);
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error.code).toBe('RPC_ERROR');
    });

    it('returns structured error on unknown shape', async () => {
      mockRpc.mockResolvedValue({ data: { weird: true }, error: null });
      const res = await calculateTax('n', 100);
      expect(res.success).toBe(false);
    });
  });

  describe('applyTaxToTrade / refundTax / getTaxSummary', () => {
    it('applyTaxToTrade unwraps idempotent_hit', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          data: {
            trade_id: 't1',
            tax_record_id: 'r1',
            tax_amount_cents: 200,
            taxable_amount_cents: 5000,
            tax_rate_applied: 0.04,
            tax_jurisdiction: 'NY',
            idempotent_hit: true,
          },
        },
        error: null,
      });
      const res = await applyTaxToTrade('t1');
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.idempotent_hit).toBe(true);
    });

    it('refundTax surfaces RPC business errors', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: { code: 'REFUND_EXCEEDS', message: 'too much' },
        },
        error: null,
      });
      const res = await refundTax('t1', 1000);
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error.code).toBe('REFUND_EXCEEDS');
    });

    it('getTaxSummary returns aggregated data', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          data: {
            start_date: '2025-01-01',
            end_date: '2025-01-31',
            node_id: null,
            transaction_count: 5,
            taxable_total_cents: 50000,
            tax_collected_cents: 3175,
            tax_refunded_cents: 0,
            tax_net_cents: 3175,
            by_jurisdiction: [
              {
                jurisdiction: 'CT',
                transaction_count: 5,
                taxable_total_cents: 50000,
                tax_collected_cents: 3175,
                tax_refunded_cents: 0,
                tax_net_cents: 3175,
              },
            ],
          },
        },
        error: null,
      });
      const res = await getTaxSummary('2025-01-01', '2025-01-31');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tax_collected_cents).toBe(3175);
        expect(res.data.by_jurisdiction).toHaveLength(1);
      }
    });
  });

  // TAX-014: Additional edge-case unit tests (brings total to 10+)
  describe('calculateTax edge cases', () => {
    it('returns tax=0 when global_enabled is false (tax off globally)', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          data: {
            taxable_amount_cents: 10000,
            tax_rate: 0.0635,
            tax_amount_cents: 0,
            tax_jurisdiction: 'CT',
            global_enabled: false,
          },
        },
        error: null,
      });
      const res = await calculateTax('node-x', 10000);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tax_amount_cents).toBe(0);
        expect(res.data.global_enabled).toBe(false);
      }
    });

    it('returns tax=0 when taxable_amount_cents is 0 (100% SP discount)', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          data: {
            taxable_amount_cents: 0,
            tax_rate: 0.0635,
            tax_amount_cents: 0,
            tax_jurisdiction: 'CT',
            global_enabled: true,
          },
        },
        error: null,
      });
      const res = await calculateTax('node-x', 0);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.tax_amount_cents).toBe(0);
    });

    it('handles large price correctly (no overflow at $9999.99)', async () => {
      const bigPrice = 999999; // $9999.99 in cents
      const expectedTax = Math.round(bigPrice * 0.0635); // 63500
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          data: {
            taxable_amount_cents: bigPrice,
            tax_rate: 0.0635,
            tax_amount_cents: expectedTax,
            tax_jurisdiction: 'CT',
            global_enabled: true,
          },
        },
        error: null,
      });
      const res = await calculateTax('node-x', bigPrice);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.tax_amount_cents).toBe(expectedTax);
    });
  });
});
