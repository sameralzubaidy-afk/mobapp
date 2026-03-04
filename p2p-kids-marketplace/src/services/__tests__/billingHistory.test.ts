// File: p2p-kids-marketplace/src/services/__tests__/billingHistory.test.ts
// SUB-014: Unit tests for billing history service

import {
  getBillingHistory,
  getBillingRecordByChargeId,
  createBillingRecord,
  updateBillingRecordStatus,
  getBillingHistorySummary,
  getRecentBillingHistory,
} from '../billingHistory';
import { supabase } from '../../config/supabase';
import type { BillingHistory } from '../../types/billingHistory.types';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Billing History Service', () => {
  const mockUserId = 'user-123';
  const mockSubscriptionId = 'sub-456';
  const mockChargeId = 'ch_test_123';

  const mockBillingRecord: BillingHistory = {
    id: 'billing-001',
    user_id: mockUserId,
    subscription_id: mockSubscriptionId,
    charge_id: mockChargeId,
    stripe_invoice_id: 'in_test_123',
    amount: 499,
    currency: 'usd',
    status: 'succeeded',
    charged_at: '2026-03-03T10:00:00Z',
    description: 'Kids Club+ Monthly - March 2026',
    error_message: null,
    created_at: '2026-03-03T10:00:00Z',
    updated_at: '2026-03-03T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBillingHistory', () => {
    it('should fetch billing history with filters', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockBillingRecord],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getBillingHistory({
        user_id: mockUserId,
        status: 'succeeded',
        limit: 10,
      });

      expect(result).toEqual([mockBillingRecord]);
      expect(supabase.from).toHaveBeenCalledWith('billing_history');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.order).toHaveBeenCalledWith('charged_at', { ascending: false });
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'succeeded');
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should handle errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((onFulfill) =>
          Promise.resolve({
            data: null,
            error: { message: 'Database error' },
          }).then(onFulfill)
        ),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await expect(getBillingHistory({ user_id: mockUserId })).rejects.toThrow(
        'Failed to fetch billing history: Database error'
      );
    });

    it('should return empty array when no records found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getBillingHistory({ user_id: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('getBillingRecordByChargeId', () => {
    it('should fetch a single billing record by charge_id', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockBillingRecord,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getBillingRecordByChargeId(mockChargeId);

      expect(result).toEqual(mockBillingRecord);
      expect(mockQuery.eq).toHaveBeenCalledWith('charge_id', mockChargeId);
    });

    it('should return null when record not found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getBillingRecordByChargeId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createBillingRecord', () => {
    it('should create a new billing record', async () => {
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockBillingRecord,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const params = {
        user_id: mockUserId,
        subscription_id: mockSubscriptionId,
        charge_id: mockChargeId,
        stripe_invoice_id: 'in_test_123',
        amount: 499,
        status: 'succeeded' as const,
        description: 'Kids Club+ Monthly - March 2026',
      };

      const result = await createBillingRecord(params);

      expect(result).toEqual(mockBillingRecord);
      expect(mockQuery.insert).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockBillingRecord, currency: 'usd' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const params = {
        user_id: mockUserId,
        subscription_id: mockSubscriptionId,
        charge_id: mockChargeId,
        amount: 499,
        status: 'succeeded' as const,
      };

      await createBillingRecord(params);

      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
          stripe_invoice_id: null,
          description: null,
          error_message: null,
        })
      );
    });
  });

  describe('updateBillingRecordStatus', () => {
    it('should update billing record status', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockBillingRecord, status: 'refunded' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await updateBillingRecordStatus(mockChargeId, 'refunded');

      expect(result.status).toBe('refunded');
      expect(mockQuery.update).toHaveBeenCalledWith({ status: 'refunded' });
      expect(mockQuery.eq).toHaveBeenCalledWith('charge_id', mockChargeId);
    });

    it('should include error message when status is failed', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockBillingRecord, status: 'failed', error_message: 'Card declined' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await updateBillingRecordStatus(mockChargeId, 'failed', 'Card declined');

      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: 'Card declined',
      });
    });
  });

  describe('getBillingHistorySummary', () => {
    it('should calculate billing summary correctly', async () => {
      const mockRecords: BillingHistory[] = [
        { ...mockBillingRecord, status: 'succeeded', amount: 499 },
        { ...mockBillingRecord, id: 'billing-002', status: 'succeeded', amount: 499 },
        { ...mockBillingRecord, id: 'billing-003', status: 'failed', amount: 499 },
        { ...mockBillingRecord, id: 'billing-004', status: 'refunded', amount: 499 },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockRecords,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const summary = await getBillingHistorySummary(mockUserId);

      expect(summary).toEqual({
        total_charges: 4,
        successful_charges: 2,
        failed_charges: 1,
        refunded_charges: 1,
        total_amount_cents: 998, // 2 successful charges at 499 each
        total_refunded_cents: 499,
        most_recent_charge: mockRecords[0],
      });
    });

    it('should handle empty billing history', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const summary = await getBillingHistorySummary(mockUserId);

      expect(summary).toEqual({
        total_charges: 0,
        successful_charges: 0,
        failed_charges: 0,
        refunded_charges: 0,
        total_amount_cents: 0,
        total_refunded_cents: 0,
        most_recent_charge: null,
      });
    });
  });

  describe('getRecentBillingHistory', () => {
    it('should fetch recent billing history with default limit', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockBillingRecord],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      const result = await getRecentBillingHistory(mockUserId);

      expect(result).toEqual([mockBillingRecord]);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should respect custom limit', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockBillingRecord],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQuery);

      await getRecentBillingHistory(mockUserId, 5);

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });
  });
});
