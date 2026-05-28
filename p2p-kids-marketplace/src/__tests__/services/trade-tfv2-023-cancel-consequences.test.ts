/**
 * File: p2p-kids-marketplace/src/__tests__/services/trade-tfv2-023-cancel-consequences.test.ts
 * MODULE-15.1.2 TFV2-023 – Unit tests for cancelTradeV2 consequence level handling
 * Run: npm run test:unit
 */

import { cancelTradeV2 } from '../../services/trade';
import { supabase } from '../../config/supabase';

// ─── Mock Supabase ──────────────────────────────────────────────────────────
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockSession = { user: { id: 'user-abc' }, access_token: 'token-xyz' };

// ─── Helper to reset mocks ───────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });
});

// ─── cancelTradeV2 – Consequence Level Tests ─────────────────────────────────
describe('cancelTradeV2 – TFV2-023 consequence level', () => {
  it('returns consequenceLevel=1 for first seller in_progress cancellation', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        tradeId: 'trade-001',
        sp_refunded: true,
        consequence_level: 1,
      },
      error: null,
    });

    const result = await cancelTradeV2('trade-001', 'cant_do_pickup');

    expect(result.success).toBe(true);
    expect(result.consequenceLevel).toBe(1);
    expect(result.sp_refunded).toBe(true);
  });

  it('returns consequenceLevel=2 for second seller in_progress cancellation', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        tradeId: 'trade-002',
        sp_refunded: false,
        consequence_level: 2,
      },
      error: null,
    });

    const result = await cancelTradeV2('trade-002', 'item_no_longer_available');

    expect(result.success).toBe(true);
    expect(result.consequenceLevel).toBe(2);
  });

  it('returns consequenceLevel=3 for third seller in_progress cancellation (admin flag)', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        tradeId: 'trade-003',
        sp_refunded: false,
        consequence_level: 3,
      },
      error: null,
    });

    const result = await cancelTradeV2('trade-003', 'other');

    expect(result.success).toBe(true);
    expect(result.consequenceLevel).toBe(3);
  });

  it('returns consequenceLevel=null for buyer cancellation (no consequence)', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        tradeId: 'trade-004',
        sp_refunded: true,
        consequence_level: null,
      },
      error: null,
    });

    const result = await cancelTradeV2('trade-004', 'Changed my mind');

    expect(result.success).toBe(true);
    expect(result.consequenceLevel).toBeNull();
  });

  it('returns consequenceLevel=null when field is absent from response', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        tradeId: 'trade-005',
        sp_refunded: false,
        // no consequence_level field
      },
      error: null,
    });

    const result = await cancelTradeV2('trade-005');

    expect(result.success).toBe(true);
    expect(result.consequenceLevel).toBeNull();
  });

  it('returns success=false with error message when edge function fails', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Trade already cancelled' },
    });

    const result = await cancelTradeV2('trade-006', 'other');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Trade already cancelled');
    expect(result.consequenceLevel).toBeUndefined();
  });

  it('returns success=false when user is not authenticated', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const result = await cancelTradeV2('trade-007');

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not authenticated');
    // invoke should never be called without auth
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('truncates reason to 500 chars and still passes to edge function', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { success: true, tradeId: 'trade-008', sp_refunded: false, consequence_level: null },
      error: null,
    });

    const longReason = 'x'.repeat(600);
    await cancelTradeV2('trade-008', longReason);

    const callArgs = (supabase.functions.invoke as jest.Mock).mock.calls[0];
    const body = callArgs[1]?.body;
    expect(body.reason.length).toBe(500);
  });

  it('uses default reason when none provided', async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { success: true, tradeId: 'trade-009', sp_refunded: false, consequence_level: null },
      error: null,
    });

    await cancelTradeV2('trade-009');

    const callArgs = (supabase.functions.invoke as jest.Mock).mock.calls[0];
    const body = callArgs[1]?.body;
    expect(body.reason).toBe('User requested cancellation');
  });

  it('handles unexpected thrown error gracefully', async () => {
    (supabase.functions.invoke as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));

    const result = await cancelTradeV2('trade-010', 'other');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });
});
