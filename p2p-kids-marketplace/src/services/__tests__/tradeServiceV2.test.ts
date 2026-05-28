/**
 * File: p2p-kids-marketplace/src/services/__tests__/tradeServiceV2.test.ts
 * TFV2-006 / TFV2-013: Unit tests for completeTradeV2, cancelTradeV2, submitOfferV2
 *
 * Covers:
 *  - D-03: buyer-only completion guard
 *  - D-26: disputed trade block on complete
 *  - SP release (non-fatal, handled by DB trigger)
 *  - cancelTradeV2: calls cancel-trade EF with reason
 *  - submitOfferV2: calls create-trade-offer EF
 *  - Error paths: unauthenticated, EF error, no data
 */

import { completeTradeV2, cancelTradeV2 } from '../trade';
import { submitOfferV2 } from '../tradeServiceV2';
import { supabase } from '../../config/supabase';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockInvoke = supabase.functions.invoke as jest.Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mockAuthUser = (userId = 'buyer-001') => {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'tok-abc', user: { id: userId } } },
  });
};

const mockAuthNone = () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockGetSession.mockResolvedValue({ data: { session: null } });
};

// ─── completeTradeV2 ─────────────────────────────────────────────────────────
describe('completeTradeV2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns success when EF responds with success: true', async () => {
    mockAuthUser('buyer-001');
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const result = await completeTradeV2('trade-aaa');

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      'complete-trade',
      expect.objectContaining({ body: expect.objectContaining({ tradeId: 'trade-aaa' }) })
    );
  });

  it('returns failure when user is not authenticated', async () => {
    mockAuthNone();

    const result = await completeTradeV2('trade-aaa');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns failure when Edge Function returns an error', async () => {
    mockAuthUser();
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Trade not in_progress' },
    });

    const result = await completeTradeV2('trade-bbb');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns failure when EF data.success is false (D-03 / D-26 guard hit)', async () => {
    mockAuthUser();
    // EF returns HTTP 200 but success: false (e.g. 403 buyer guard)
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Only the buyer can complete this trade' },
      error: null,
    });

    const result = await completeTradeV2('trade-ccc');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/buyer/i);
  });

  it('returns failure when EF data.success is false due to active dispute (D-26)', async () => {
    mockAuthUser();
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Trade has an active dispute' },
      error: null,
    });

    const result = await completeTradeV2('trade-disputed');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/dispute/i);
  });

  it('handles unexpected thrown error gracefully', async () => {
    mockAuthUser();
    mockInvoke.mockRejectedValue(new Error('network timeout'));

    const result = await completeTradeV2('trade-ddd');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/network timeout/i);
  });
});

// ─── cancelTradeV2 ───────────────────────────────────────────────────────────
describe('cancelTradeV2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns success with sp_refunded flag when cancel-trade succeeds', async () => {
    mockAuthUser();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockInvoke.mockResolvedValue({
      data: { success: true, sp_refunded: true, message: 'Trade cancelled' },
      error: null,
    });

    const result = await cancelTradeV2('trade-eee', 'buyer_requested');

    expect(result.success).toBe(true);
    expect(result.sp_refunded).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      'cancel-trade',
      expect.objectContaining({ body: expect.objectContaining({ tradeId: 'trade-eee' }) })
    );
  });

  it('truncates reason to 500 characters', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    const longReason = 'x'.repeat(600);
    await cancelTradeV2('trade-fff', longReason);

    const invokeBody = mockInvoke.mock.calls[0][1].body;
    expect(invokeBody.reason.length).toBe(500);
  });

  it('uses default reason when none provided', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await cancelTradeV2('trade-ggg');

    const invokeBody = mockInvoke.mock.calls[0][1].body;
    expect(invokeBody.reason).toBe('User requested cancellation');
  });

  it('returns failure when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await cancelTradeV2('trade-hhh');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns failure when EF returns error', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Cannot cancel a completed trade' },
    });

    const result = await cancelTradeV2('trade-iii');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns consequenceLevel from EF response (TFV2-023)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockInvoke.mockResolvedValue({
      data: { success: true, consequence_level: 2, sp_refunded: false },
      error: null,
    });

    const result = await cancelTradeV2('trade-jjj', 'seller_no_show');

    expect(result.consequenceLevel).toBe(2);
  });

  it('handles thrown error gracefully', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-abc' } },
    });
    mockInvoke.mockRejectedValue(new Error('Edge function unreachable'));

    const result = await cancelTradeV2('trade-kkk');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unreachable/i);
  });
});

// ─── submitOfferV2 ───────────────────────────────────────────────────────────
describe('submitOfferV2', () => {
  beforeEach(() => jest.clearAllMocks());

  const validInput = {
    listingId: 'listing-001',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    cashAmountCents: 1000,
    spAmount: 0,
  };

  it('calls create-trade-offer EF and returns result on success', async () => {
    const mockTrade = { id: 'trade-new', status: 'pending' };
    mockInvoke.mockResolvedValue({
      data: { trade: mockTrade, spReserved: 0, authorizationExpiresAt: '2026-06-01T00:00:00Z' },
      error: null,
    });

    const result = await submitOfferV2(validInput);

    expect(result.trade).toEqual(mockTrade);
    expect(mockInvoke).toHaveBeenCalledWith(
      'create-trade-offer',
      expect.objectContaining({
        body: expect.objectContaining({
          listing_id: 'listing-001',
          buyer_id: 'buyer-001',
          seller_id: 'seller-001',
          cash_amount_cents: 1000,
          sp_amount: 0,
        }),
      })
    );
  });

  it('passes bundleId when provided (D-27)', async () => {
    mockInvoke.mockResolvedValue({
      data: { trade: {}, spReserved: 0, authorizationExpiresAt: '' },
      error: null,
    });

    await submitOfferV2({ ...validInput, bundleId: 'bundle-xyz' });

    const invokeBody = mockInvoke.mock.calls[0][1].body;
    expect(invokeBody.bundle_id).toBe('bundle-xyz');
  });

  it('throws when EF returns error (e.g. MAX_OFFERS_REACHED)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'MAX_OFFERS_REACHED: buyer has 3 pending offers' },
    });

    await expect(submitOfferV2(validInput)).rejects.toThrow(/MAX_OFFERS_REACHED/i);
  });

  it('throws when EF returns no data', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(submitOfferV2(validInput)).rejects.toThrow(/No data returned/i);
  });

  it('throws on INSUFFICIENT_FUNDS error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_FUNDS: not enough SP' },
    });

    await expect(submitOfferV2(validInput)).rejects.toThrow(/INSUFFICIENT_FUNDS/i);
  });
});
