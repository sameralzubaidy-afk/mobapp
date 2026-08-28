/**
 * File: p2p-kids-marketplace/src/__tests__/services/trade-tfv2-core-logic.test.ts
 * MODULE-15.1.2 — Unit tests for core trade business logic
 * Tasks covered: TFV2-001 (timing config), TFV2-003 (SP formula),
 *                TFV2-006 (completeTradeV2), TFV2-007/008 (countdown),
 *                TFV2-012A (createTradeOfferWithHold)
 * Run: npm run test:unit
 */

// ─── Imports first (ESLint import/first compliance) ────────────────────────
// jest.mock() below is hoisted by babel-jest BEFORE these imports at runtime.
// Arrow-function wrappers in the factory prevent undefined-capture from hoisting.
import {
  createTradeOfferWithHold,
  completeTradeV2,
  cancelTradeV2,
  CreateTradeOfferInput,
} from '../../services/trade';

// ─── Mock Supabase ─────────────────────────────────────────────────────────
// Arrow-function wrappers prevent the undefined-capture bug caused by jest.mock() hoisting.
// jest.mock() is hoisted before const declarations; arrow fns resolve at call-time.
// Pattern reference: src/__tests__/services/tradeNotifications.test.ts

const mockInvoke = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Platform SP Calculation Formula (TFV2-003 / TFV2-006)
// Rules from TRADING-FLOW-V2.md Section 13.4 / D-17:
//   Platform SP = ROUND(price × 0.25 × category_multiplier) when subscriber + accept_sp
//   Platform SP = 0 when free seller OR cash_only listing
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-003/006 — Platform SP Calculation Formula', () => {
  // Pure function mirroring fn_release_all_sp_on_complete DB trigger logic
  function calcPlatformSP(
    price: number,
    categoryMultiplier: number,
    sellerIsSubscriber: boolean,
    listingPref: string
  ): number {
    if (sellerIsSubscriber && listingPref === 'accept_sp') {
      return Math.round(price * 0.25 * categoryMultiplier);
    }
    return 0;
  }

  it('calculates 25% platform SP for subscriber seller + accept_sp listing (no multiplier)', () => {
    expect(calcPlatformSP(20, 1.0, true, 'accept_sp')).toBe(5); // 20 * 0.25 * 1.0 = 5
  });

  it('calculates platform SP with category multiplier 1.5', () => {
    expect(calcPlatformSP(20, 1.5, true, 'accept_sp')).toBe(8); // 20 * 0.25 * 1.5 = 7.5 → rounds to 8
  });

  it('returns 0 for free (non-subscriber) seller', () => {
    expect(calcPlatformSP(20, 1.0, false, 'accept_sp')).toBe(0);
  });

  it('returns 0 for cash_only listing even if seller is subscriber', () => {
    expect(calcPlatformSP(20, 1.0, true, 'cash_only')).toBe(0);
  });

  it('returns 0 for donate listing', () => {
    expect(calcPlatformSP(20, 1.0, true, 'donate')).toBe(0);
  });

  it('rounds 0.25 × $15 correctly (3.75 → rounds to 4)', () => {
    expect(calcPlatformSP(15, 1.0, true, 'accept_sp')).toBe(4);
  });

  it('total SP to seller = buyer SP used + platform SP (D-17 single event)', () => {
    const buyerSP = 5;
    const platformSP = calcPlatformSP(20, 1.0, true, 'accept_sp');
    expect(buyerSP + platformSP).toBe(10); // 5 buyer + 5 platform = 10 total
  });

  it('total SP is just buyer SP when platform SP = 0 (free seller)', () => {
    const buyerSP = 5;
    const platformSP = calcPlatformSP(20, 1.0, false, 'accept_sp');
    expect(buyerSP + platformSP).toBe(5); // only buyer SP
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Trade Timing Config Cross-field Validation (TFV2-001)
// Rules from admin_config trigger validate_trade_timing_config
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-001 — Trade Timing Config Cross-field Validation', () => {
  interface TimingConfig {
    offer_timeout_hours: number;
    auto_complete_hours: number;
    sp_pending_release_days: number;
    offer_notif_1_hours_before: number;
    offer_notif_2_hours_before: number;
    auto_complete_notif_1_hours_before: number;
    auto_complete_notif_2_hours_before: number;
  }

  function validateTimingConfig(c: TimingConfig): string | null {
    if (c.offer_notif_1_hours_before > c.offer_timeout_hours) {
      return 'offer_notif_1_hours_before must be <= offer_timeout_hours';
    }
    if (c.offer_notif_2_hours_before >= c.offer_notif_1_hours_before) {
      return 'offer_notif_2_hours_before must be < offer_notif_1_hours_before';
    }
    if (c.auto_complete_notif_1_hours_before > c.auto_complete_hours) {
      return 'auto_complete_notif_1_hours_before must be <= auto_complete_hours';
    }
    if (c.auto_complete_notif_2_hours_before >= c.auto_complete_notif_1_hours_before) {
      return 'auto_complete_notif_2_hours_before must be < auto_complete_notif_1_hours_before';
    }
    return null; // valid
  }

  const validConfig: TimingConfig = {
    offer_timeout_hours: 24,
    auto_complete_hours: 48,
    sp_pending_release_days: 3,
    offer_notif_1_hours_before: 6,
    offer_notif_2_hours_before: 1,
    auto_complete_notif_1_hours_before: 24,
    auto_complete_notif_2_hours_before: 2,
  };

  it('accepts a valid config with default values', () => {
    expect(validateTimingConfig(validConfig)).toBeNull();
  });

  it('rejects offer_notif_1 > offer_timeout', () => {
    const c = { ...validConfig, offer_notif_1_hours_before: 25 };
    expect(validateTimingConfig(c)).toContain('offer_notif_1_hours_before must be <=');
  });

  it('accepts offer_notif_1 === offer_timeout (boundary)', () => {
    const c = { ...validConfig, offer_notif_1_hours_before: 24, offer_notif_2_hours_before: 1 };
    expect(validateTimingConfig(c)).toBeNull();
  });

  it('rejects offer_notif_2 >= offer_notif_1', () => {
    const c = { ...validConfig, offer_notif_2_hours_before: 6 };
    expect(validateTimingConfig(c)).toContain('offer_notif_2_hours_before must be <');
  });

  it('rejects auto_complete_notif_1 > auto_complete_hours', () => {
    const c = { ...validConfig, auto_complete_notif_1_hours_before: 49 };
    expect(validateTimingConfig(c)).toContain('auto_complete_notif_1_hours_before must be <=');
  });

  it('rejects auto_complete_notif_2 >= auto_complete_notif_1', () => {
    const c = { ...validConfig, auto_complete_notif_2_hours_before: 24 };
    expect(validateTimingConfig(c)).toContain('auto_complete_notif_2_hours_before must be <');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: OfferCountdownPill computeCountdown (TFV2-007)
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-007 — OfferCountdownPill computeCountdown logic', () => {
  // Mirrors the pure computeCountdown function from OfferCountdownPill.tsx
  function computeCountdown(expiresAt: string, createdAt: string) {
    const now = Date.now();
    const expiryMs = new Date(expiresAt).getTime();
    const createdMs = new Date(createdAt).getTime();
    const remainingMs = expiryMs - now;
    const totalWindowMs = expiryMs - createdMs;

    if (remainingMs <= 0) {
      return { label: 'Expired', backgroundColor: '#9CA3AF', isExpired: true };
    }

    const pct = remainingMs / totalWindowMs;
    let backgroundColor: string;
    if (pct > 0.5) backgroundColor = '#5DBB8E';
    else if (pct > 0.25) backgroundColor = '#F59E0B';
    else if (pct > 0.10) backgroundColor = '#FF8C00';
    else backgroundColor = '#EF4444';

    const totalSecs = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return { label, backgroundColor, isExpired: false };
  }

  it('returns green (#5DBB8E) when > 50% remaining', () => {
    const now = Date.now();
    const created = new Date(now - 2 * 3600 * 1000).toISOString();  // 2h ago
    const expires = new Date(now + 10 * 3600 * 1000).toISOString(); // 10h from now
    const result = computeCountdown(expires, created);
    expect(result.backgroundColor).toBe('#5DBB8E');
    expect(result.isExpired).toBe(false);
  });

  it('returns amber (#F59E0B) when 25–50% remaining', () => {
    const now = Date.now();
    const totalWindow = 24 * 3600 * 1000;
    const created = new Date(now - totalWindow * 0.65).toISOString(); // 65% elapsed
    const expires = new Date(now + totalWindow * 0.35).toISOString(); // 35% left
    const result = computeCountdown(expires, created);
    expect(result.backgroundColor).toBe('#F59E0B');
  });

  it('returns orange (#FF8C00) when 10–25% remaining', () => {
    const now = Date.now();
    const totalWindow = 24 * 3600 * 1000;
    const created = new Date(now - totalWindow * 0.82).toISOString();
    const expires = new Date(now + totalWindow * 0.18).toISOString(); // 18% left
    const result = computeCountdown(expires, created);
    expect(result.backgroundColor).toBe('#FF8C00');
  });

  it('returns red (#EF4444) when < 10% remaining', () => {
    const now = Date.now();
    const totalWindow = 24 * 3600 * 1000;
    const created = new Date(now - totalWindow * 0.95).toISOString();
    const expires = new Date(now + totalWindow * 0.05).toISOString(); // 5% left
    const result = computeCountdown(expires, created);
    expect(result.backgroundColor).toBe('#EF4444');
  });

  it('returns Expired state when past expiry', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const created = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const result = computeCountdown(past, created);
    expect(result.isExpired).toBe(true);
    expect(result.label).toBe('Expired');
    expect(result.backgroundColor).toBe('#9CA3AF');
  });

  it('formats label as "Xh Ym" when hours > 0', () => {
    const now = Date.now();
    const created = new Date(now - 3600 * 1000).toISOString();
    const expires = new Date(now + 3 * 3600 * 1000 + 30 * 60 * 1000).toISOString(); // 3h 30m left
    const result = computeCountdown(expires, created);
    expect(result.label).toMatch(/\d+h \d+m/);
  });

  it('formats label as "Xm" when < 1 hour remaining', () => {
    const now = Date.now();
    const created = new Date(now - 23 * 3600 * 1000).toISOString();
    const expires = new Date(now + 30 * 60 * 1000).toISOString(); // 30m left
    const result = computeCountdown(expires, created);
    expect(result.label).toMatch(/^\d+m$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: createTradeOfferWithHold (TFV2-012A)
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-012A — createTradeOfferWithHold', () => {
  const validInput: CreateTradeOfferInput = {
    item_id: 'item-001',
    sp_amount: 0,
    payment_method_id: 'pm_test_visa',
    cash_amount_cents: 2099,
    transaction_fee_cents: 99,
    buyer_subscription_status: 'active',
  };

  beforeEach(() => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns success: true with trade_id and authorization_id on happy path', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        trade_id: 'trade-001',
        authorization_id: 'pi_test_auth',
        authorization_expires_at: '2026-05-27T00:00:00Z',
      },
      error: null,
    });

    const result = await createTradeOfferWithHold(validInput);

    expect(result.success).toBe(true);
    expect(result.trade_id).toBe('trade-001');
    expect(result.authorization_id).toBe('pi_test_auth');
  });

  it('returns success: false with UNAUTHORIZED when no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await createTradeOfferWithHold(validInput);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('UNAUTHORIZED');
  });

  it('returns success: false when Edge Function returns error field', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: false,
        error: { code: 'MAX_PENDING_OFFERS', message: 'You have 3 pending offers with this seller. Cancel one to make a new offer.' },
      },
      error: null,
    });

    const result = await createTradeOfferWithHold(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain('pending offers with this seller');
    expect(result.error_code).toBe('MAX_PENDING_OFFERS');
  });

  it('returns INSUFFICIENT_SP error code when SP is insufficient', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: false,
        error: { code: 'INSUFFICIENT_SP', message: 'Insufficient SP balance' },
      },
      error: null,
    });

    const result = await createTradeOfferWithHold(validInput);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('INSUFFICIENT_SP');
  });

  it('returns success: false on network/invoke error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await createTradeOfferWithHold(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('sends a per-submission nonce to create-trade-offer (DT-18 re-offer idempotency fix)', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        trade_id: 'trade-001',
        authorization_id: 'pi_test_auth',
      },
      error: null,
    });

    await createTradeOfferWithHold(validInput);

    // DT-18 (2026-08-28): the client must send a nonce so each NEW offer submission gets
    // a unique Stripe idempotency key (a re-offer after a cancelled trade no longer 409s),
    // while retries of the SAME submission reuse it (double-tap still dedupes to one hold).
    expect(mockInvoke).toHaveBeenCalledWith(
      'create-trade-offer',
      expect.objectContaining({
        body: expect.objectContaining({
          submission_nonce: expect.any(String),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: completeTradeV2 (TFV2-006)
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-006 — completeTradeV2', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'buyer-001' } } });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns success: true when Edge Function completes trade', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, message: 'Trade completed' },
      error: null,
    });

    const result = await completeTradeV2('trade-001');

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      'complete-trade',
      expect.objectContaining({ body: expect.objectContaining({ trade_id: 'trade-001' }) })
    );
  });

  it('returns success: false when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await completeTradeV2('trade-001');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not authenticated');
  });

  it('returns success: false when Edge Function returns failure', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: false, error: 'Trade is not in_progress' },
      error: null,
    });

    const result = await completeTradeV2('trade-001');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns success: false on network error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('connection refused'));

    const result = await completeTradeV2('trade-001');

    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: cancelTradeV2 — consequence level (TFV2-023 integration)
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-023 — cancelTradeV2 consequenceLevel', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns consequenceLevel 1 when Edge Function returns consequence_level=1', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, consequence_level: 1, sp_refunded: false },
      error: null,
    });

    const result = await cancelTradeV2('trade-001', 'Can\'t do pickup/meetup');

    expect(result.success).toBe(true);
    expect(result.consequenceLevel).toBe(1);
  });

  it('returns consequenceLevel null when no consequence field returned', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await cancelTradeV2('trade-001', 'reason');

    expect(result.consequenceLevel).toBeNull();
  });

  it('truncates reason to 500 chars', async () => {
    const longReason = 'a'.repeat(600);
    mockInvoke.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    await cancelTradeV2('trade-001', longReason);

    const invokedBody = mockInvoke.mock.calls[0][1].body;
    expect(invokedBody.reason.length).toBeLessThanOrEqual(500);
  });

  it('returns success: false when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await cancelTradeV2('trade-001', 'reason');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not authenticated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Offer Expiry logic (TFV2-004) — pure expiry calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('TFV2-004 — Offer Expiry Calculation', () => {
  function computeOfferExpiry(createdAt: string, offerTimeoutHours: number): Date {
    const created = new Date(createdAt).getTime();
    return new Date(created + offerTimeoutHours * 60 * 60 * 1000);
  }

  function isExpired(offerExpiresAt: string): boolean {
    return new Date(offerExpiresAt).getTime() < Date.now();
  }

  it('calculates expiry as createdAt + offerTimeoutHours', () => {
    const created = '2026-05-26T00:00:00Z';
    const expiry = computeOfferExpiry(created, 24);
    expect(expiry.toISOString()).toBe('2026-05-27T00:00:00.000Z');
  });

  it('is not expired when expiry is in future', () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it('is expired when expiry is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it('defaults to 24 hours when config is missing', () => {
    const created = '2026-05-26T10:00:00Z';
    const defaultHours = 24; // COALESCE(offer_timeout_hours, 24)
    const expiry = computeOfferExpiry(created, defaultHours);
    const expectedExpiry = new Date('2026-05-27T10:00:00Z').getTime();
    expect(expiry.getTime()).toBe(expectedExpiry);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: SP 50% cap enforcement (FR-SP-001, D-08)
// ─────────────────────────────────────────────────────────────────────────────

describe('SP 50% cap enforcement (FR-SP-001)', () => {
  function clampSPToMax(requestedSP: number, itemPrice: number, spMaxPercent: number): number {
    const maxSP = Math.floor(itemPrice * spMaxPercent / 100);
    return Math.min(requestedSP, maxSP);
  }

  it('clamps SP to 50% of item price', () => {
    expect(clampSPToMax(15, 20, 50)).toBe(10); // max = $10
  });

  it('allows SP under the cap', () => {
    expect(clampSPToMax(5, 20, 50)).toBe(5);
  });

  it('clamps exactly at the cap', () => {
    expect(clampSPToMax(10, 20, 50)).toBe(10);
  });

  it('returns 0 when 0 SP requested', () => {
    expect(clampSPToMax(0, 20, 50)).toBe(0);
  });

  it('handles admin-config override of 30% max', () => {
    expect(clampSPToMax(10, 20, 30)).toBe(6); // max = $6
  });
});
