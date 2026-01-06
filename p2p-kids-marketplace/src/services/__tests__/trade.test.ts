/**
 * File: p2p-kids-marketplace/src/services/__tests__/trade.test.ts
 * MODULE-06-TRADE-FLOW-V2: Unit tests for trade service
 */

import { initiateTradeV2 } from '../trade';
import { supabase } from '../../config/supabase';
import * as subscriptionService from '../subscription';
import * as adminConfigService from '../adminConfig';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock other services
jest.mock('../subscription');
jest.mock('../adminConfig');

describe('trade service', () => {
  const mockUser = { id: 'buyer-123', email: 'buyer@example.com' };
  const mockItem = {
    id: 'item-456',
    seller_id: 'seller-789',
    status: 'available',
    price: 10.00, // $10.00
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: mockUser } });
    (adminConfigService.getAdminConfig as jest.Mock).mockResolvedValue({
      sp_max_percentage_per_purchase: 50,
    });
  });

  describe('initiateTradeV2', () => {
    it('should initiate trade for subscriber with SP discount', async () => {
      // Mock item
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockItem, error: null }),
          };
        }
        if (table === 'trades') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'trade-999' }, error: null }),
          };
        }
        return {};
      });

      // Mock subscription: Active subscriber
      (subscriptionService.getSubscriptionSummary as jest.Mock).mockResolvedValue({
        status: 'active',
        is_subscriber: true,
        can_spend_sp: true,
      });

      // Mock SP wallet: 100 SP available
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { available_points: 100 },
        error: null,
      });

      const result = await initiateTradeV2({
        item_id: 'item-456',
        sp_amount: 5, // Request 5 SP discount ($5.00)
      });

      expect(result.success).toBe(true);
      expect(result.appliedPoints).toBe(5);
      // Item $10 - $5 discount + $0.99 fee = $5.99 (599 cents)
      expect(result.cashAmountCents).toBe(599);
      expect(result.transactionFeeCents).toBe(99);
    });

    it('should clamp SP discount to 50% of item price', async () => {
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockItem, error: null }),
          };
        }
        if (table === 'trades') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'trade-999' }, error: null }),
          };
        }
        return {};
      });

      (subscriptionService.getSubscriptionSummary as jest.Mock).mockResolvedValue({
        status: 'active',
        is_subscriber: true,
        can_spend_sp: true,
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { available_points: 100 },
        error: null,
      });

      const result = await initiateTradeV2({
        item_id: 'item-456',
        sp_amount: 8, // Request 8 SP ($8.00) on $10 item
      });

      expect(result.success).toBe(true);
      // Clamped to 50% of $10 = $5.00 (5 SP)
      expect(result.appliedPoints).toBe(5);
      expect(result.cashAmountCents).toBe(599);
    });

    it('should reject SP discount for non-subscribers', async () => {
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockItem, error: null }),
          };
        }
        if (table === 'trades') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'trade-999' }, error: null }),
          };
        }
        return {};
      });

      // Mock subscription: Free user
      (subscriptionService.getSubscriptionSummary as jest.Mock).mockResolvedValue({
        status: 'free',
        is_subscriber: false,
        can_spend_sp: false,
      });

      const result = await initiateTradeV2({
        item_id: 'item-456',
        sp_amount: 5,
      });

      expect(result.success).toBe(true);
      expect(result.appliedPoints).toBe(0); // Clamped to 0
      // Item $10 + $2.99 fee = $12.99 (1299 cents)
      expect(result.cashAmountCents).toBe(1299);
      expect(result.transactionFeeCents).toBe(299);
    });

    it('should reject self-purchase', async () => {
      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'items') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ 
              data: { ...mockItem, seller_id: mockUser.id }, 
              error: null 
            }),
          };
        }
        return {};
      });

      const result = await initiateTradeV2({
        item_id: 'item-456',
        sp_amount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot buy your own item');
    });
  });

  describe('completeTradeV2', () => {
    it('should call complete-trade edge function', async () => {
      // Mock supabase.functions.invoke
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const { completeTradeV2 } = require('../trade');
      const result = await completeTradeV2('trade-123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith('complete-trade', {
        body: { tradeId: 'trade-123' },
      });
      expect(result.success).toBe(true);
    });

    it('should handle edge function errors', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Function error' },
      });

      const { completeTradeV2 } = require('../trade');
      const result = await completeTradeV2('trade-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Function error');
    });
  });

  describe('processTradePayment', () => {
    it('should call trade-payment edge function', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, status: 'in_progress' },
        error: null,
      });

      const { processTradePayment } = require('../trade');
      const result = await processTradePayment('trade-123', 'pm_123');

      expect(supabase.functions.invoke).toHaveBeenCalledWith('trade-payment', {
        body: { tradeId: 'trade-123', paymentMethodId: 'pm_123' },
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('in_progress');
    });

    it('should handle edge function errors', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Payment failed' },
      });

      const { processTradePayment } = require('../trade');
      const result = await processTradePayment('trade-123', 'pm_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });
  });

  describe('cancelTradeV2', () => {
    beforeEach(() => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should cancel trade with reason', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, sp_refunded: false },
        error: null,
      });

      const { cancelTradeV2 } = require('../trade');
      const result = await cancelTradeV2('trade-123', 'Changed my mind');

      expect(supabase.functions.invoke).toHaveBeenCalledWith('cancel-trade', {
        body: { tradeId: 'trade-123', reason: 'Changed my mind' },
      });
      expect(result.success).toBe(true);
      expect(result.sp_refunded).toBe(false);
    });

    it('should handle SP refund on cancellation', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true, sp_refunded: true },
        error: null,
      });

      const { cancelTradeV2 } = require('../trade');
      const result = await cancelTradeV2('trade-456', 'Item damaged');

      expect(result.success).toBe(true);
      expect(result.sp_refunded).toBe(true);
    });

    it('should handle trade not found error', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'no rows returned' },
      });

      const { cancelTradeV2 } = require('../trade');
      const result = await cancelTradeV2('nonexistent', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle permission denied', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      });

      const { cancelTradeV2 } = require('../trade');
      const result = await cancelTradeV2('trade-123', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('should truncate long cancellation reason to 500 chars', async () => {
      const longReason = 'A'.repeat(600);
      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const { cancelTradeV2 } = require('../trade');
      await cancelTradeV2('trade-123', longReason);

      const callArgs = (supabase.functions.invoke as jest.Mock).mock.calls[0][1];
      expect(callArgs.body.reason.length).toBeLessThanOrEqual(500);
    });
  });
});
