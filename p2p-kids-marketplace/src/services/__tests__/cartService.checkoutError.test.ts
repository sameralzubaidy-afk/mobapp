/**
 * File: p2p-kids-marketplace/src/services/__tests__/cartService.checkoutError.test.ts
 *
 * FIX-Task-16 item 1 (+ item 2): a failed checkout submission must surface the
 * Edge Function's OWN `{ code, message }` — not the generic
 * "Failed to submit offers for all items".
 *
 * Regression guard for the misdiagnosis this class of bug caused: a 409
 * `MAX_PENDING_OFFERS` rejection was indistinguishable from a real outage
 * because the client logged only the FunctionsHttpError's HTTP-level message
 * (BP-39) and showed generic copy.
 */

import { checkoutCart } from '../cartService';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: () => mockGetSession(),
    },
    rpc: (fn: string, params?: unknown) => mockRpc(fn, params),
    functions: {
      invoke: (name: string, options?: unknown) => mockInvoke(name, options),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { value: 'true' }, error: null }),
          }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
    removeChannel: () => undefined,
  },
}));

jest.mock('@/services/adminConfig', () => ({
  getBuyerFeeForCheckout: jest.fn(async () => ({
    feeCents: 149,
    feeState: 'flat',
    label: 'Safety & Platform Fee',
  })),
  getChargeOneFeePerBundle: jest.fn(async () => true),
}));

jest.mock('@/services/subscription', () => ({
  getPaymentMethod: jest.fn(async () => ({ id: 'pm_test_1' })),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function cartRow(id: string, priceCents: number) {
  return {
    cart_item_id: `CI-${id}`,
    listing_id: id,
    seller_id: 'S-1',
    cart_id: 'C-1',
    added_at: '2026-09-11T00:00:00Z',
    live_title: `Item ${id}`,
    live_price_cents: priceCents,
    live_status: 'available',
    live_accepts_sp: false,
    snapshot_payment_preference: 'cash_only',
  };
}

/** The EF's structured 409 body, as `jsonError()` writes it. */
const pendingOffersBody = {
  success: false,
  error: {
    code: 'MAX_PENDING_OFFERS',
    message: 'You have 3 pending offers with this seller. Cancel one to make a new offer.',
  },
};

/** supabase-js FunctionsHttpError shape: hardcoded message + Response in context. */
function httpErrorWithBody(body: unknown) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: { clone: () => ({ json: async () => body }) },
  };
}

function primeCart() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'tok' } },
    error: null,
  });
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === 'rpc_cart_validate_for_checkout') {
      return {
        data: {
          success: true,
          data: {
            ok: true,
            cart_total_cents: 9000,
            item_count: 2,
            seller_count: 1,
            min_cart_value_cents: 0,
            errors: [],
          },
        },
        error: null,
      };
    }
    if (fn === 'rpc_cart_get_items') {
      return {
        data: {
          success: true,
          data: {
            active_cart_items: [cartRow('L-1', 4500), cartRow('L-2', 4500)],
            saved_carts: [],
            is_subscriber: true,
          },
        },
        error: null,
      };
    }
    throw new Error(`unexpected rpc call: ${fn}`);
  });
}

beforeEach(() => {
  mockRpc.mockReset();
  mockInvoke.mockReset();
  mockGetUser.mockReset();
  mockGetSession.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('cartService.checkoutCart — structured EF error (FIX-Task-16 item 1)', () => {
  it('surfaces the EF { code, message } from a non-2xx FunctionsHttpError body', async () => {
    primeCart();
    mockInvoke.mockResolvedValue({ data: null, error: httpErrorWithBody(pendingOffersBody) });

    const result = await checkoutCart({
      bundleId: 'C-1',
      isSubscriber: true,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('MAX_PENDING_OFFERS');
    expect(result.error.message).toBe(
      'You have 3 pending offers with this seller. Cancel one to make a new offer.'
    );
  });

  it('keeps the shared helper fallback for a transport error (no EF body)', async () => {
    primeCart();
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Network request failed' },
    });

    const result = await checkoutCart({ bundleId: 'C-1', isSubscriber: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    // Code falls back to the generic one; the message keeps the shared helper's
    // existing behaviour (transport message is more useful than generic copy).
    expect(result.error.code).toBe('ALL_OFFERS_FAILED');
    expect(result.error.message).toBe('Network request failed');
  });

  it('falls back to the generic copy when nothing is readable at all', async () => {
    primeCart();
    mockInvoke.mockResolvedValue({ data: null, error: {} });

    const result = await checkoutCart({ bundleId: 'C-1', isSubscriber: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('ALL_OFFERS_FAILED');
    expect(result.error.message).toBe('Failed to submit offers for all items');
  });

  it('reads the code from a 200 response whose body reports success:false', async () => {
    primeCart();
    mockInvoke.mockResolvedValue({ data: pendingOffersBody, error: null });

    const result = await checkoutCart({ bundleId: 'C-1', isSubscriber: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('MAX_PENDING_OFFERS');
    expect(result.error.message).toContain('pending offers');
  });
});
