/**
 * Unit Tests: ReviewOfferScreen — FIX-Task-26 item 2 (QA Phase 0 F7 + F8 + UX item 1)
 *
 * F7: the action area's else-branch was a two-way ternary on `pending`, so every
 *     other status rendered "This offer has expired and can no longer be
 *     accepted." — including `in_progress`, i.e. an offer the seller had just
 *     accepted themself.
 * F8: the bundle banner counted the WHOLE bundle while the CTA counted pending
 *     items only, so one render showed "Bundle offer · 3 items" above
 *     "Accept All 2 Items".
 * UX item 1: after accepting one sibling there was no route to the others.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewOfferScreen from '../ReviewOfferScreen';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  setQaLocalValue,
  getSimulatedOfferLoadStall,
  QA_OFFER_LOAD_STALL_KEY,
} from '@/services/devTestingService';

const mockNavigate = jest.fn();

jest.mock('@/config/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/hooks/useAuth');
jest.mock('@/services/tradeServiceV2', () => ({
  respondToOffer: jest.fn(async () => ({ success: true })),
  acceptBundleOffers: jest.fn(async () => ({ trades: [] })),
}));
jest.mock('@/services/spCalculatorService', () => ({
  previewTotalSPToSeller: jest.fn(async () => 0),
}));
jest.mock('@/services/subscription', () => ({
  getSubscriptionSummary: jest.fn(async () => ({ is_subscriber: false })),
}));
jest.mock('@/services/adminConfig', () => ({
  getSPReleaseDays: jest.fn(async () => 3),
}));
jest.mock('@/services/errorReporter', () => ({
  captureException: jest.fn(),
}));
jest.mock('@/services/tradeRefreshRegistry', () => ({
  requestTradesRefresh: jest.fn(),
}));
jest.mock('@/providers/GlobalAlertProvider', () => ({
  useGlobalAlert: () => ({ showAlert: jest.fn() }),
}));
// STABLE objects: the screen's focus effect depends on `fetchOffer`, whose
// useCallback deps include `navigation` — a fresh object per render would re-create
// the callback and drive an endless fetch/render loop (the real hook is stable).
const mockStableNavigation = { navigate: mockNavigate, goBack: jest.fn() };
const mockStableRoute = { params: { tradeId: 'trade-1' } };

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const ReactLib = require('react');
    ReactLib.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
  useNavigation: () => mockStableNavigation,
  useRoute: () => mockStableRoute,
}));
// Render the confirmation modal's copy so the label can be asserted, nothing else.
jest.mock('@/components/molecules/TradeConfirmationModal', () => {
  const ReactLib = require('react');
  const { Text } = require('react-native');
  return {
    TradeConfirmationModal: ({ visible, title, confirmLabel }: any) =>
      visible
        ? ReactLib.createElement(
            ReactLib.Fragment,
            null,
            ReactLib.createElement(Text, null, title),
            ReactLib.createElement(Text, null, confirmLabel)
          )
        : null,
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function mockTradesFailure() {
  const chain: any = {};
  for (const method of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'range']) {
    chain[method] = () => chain;
  }
  chain.single = () => Promise.resolve({ data: null, error: { message: 'Gateway Timeout' } });
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.then = (resolve: any) =>
    Promise.resolve({ data: null, error: { message: 'Gateway Timeout' } }).then(resolve);
  (mockSupabase.from as jest.Mock).mockImplementation(() => chain);
}

function makeOffer(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'trade-1',
    listing_id: 'listing-1',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    status,
    cancellation_reason: null,
    sp_amount: 0,
    cash_amount_cents: 2500,
    buyer_transaction_fee_cents: 149,
    seller_transaction_fee_cents: 99,
    created_at: new Date().toISOString(),
    offer_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    bundle_id: null,
    listing: { title: 'QA Item', price: 25, images: [{ url: 'https://x/y.jpg' }] },
    buyer_profile: { name: 'Buyer' },
    ...overrides,
  };
}

/**
 * The screen reads three shapes:
 *   - `from('trades')…single()`        → the offer itself
 *   - `from('trades')…` (awaited)      → the bundle siblings array
 *   - `from('profiles')…maybeSingle()` → the buyer's name
 * Each shape gets its own resolver.
 */
function mockTrades(offer: any, siblings: any[] = []) {
  const buildChain = (single: unknown, awaited: unknown) => {
    const chain: any = {};
    for (const method of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'range']) {
      chain[method] = () => chain;
    }
    chain.single = () => Promise.resolve({ data: single, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: single, error: null });
    chain.then = (resolve: any) => Promise.resolve({ data: awaited, error: null }).then(resolve);
    return chain;
  };

  (mockSupabase.from as jest.Mock).mockImplementation((table: string) =>
    table === 'profiles'
      ? buildChain({ name: 'Buyer' }, { name: 'Buyer' })
      : buildChain(offer, siblings)
  );
}

describe('ReviewOfferScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { user: { id: 'seller-1' } } } as any);
  });

  it('replaces an indefinite spinner with a retryable error state (F6)', async () => {
    mockTradesFailure();
    const { findByTestId, queryByText } = render(<ReviewOfferScreen />);

    expect(await findByTestId('review-offer-load-error')).toBeTruthy();
    expect(await findByTestId('review-offer-retry-button')).toBeTruthy();
    // The old behaviour was an Alert followed by a goBack dead end.
    expect(queryByText('Loading offer...')).toBeNull();
  });

  it('does not call an offer the seller just accepted "expired"', async () => {
    mockTrades(makeOffer('in_progress'));
    const { findByText, queryByText } = render(<ReviewOfferScreen />);

    expect(
      await findByText('You accepted this offer — the trade is now in progress.')
    ).toBeTruthy();
    expect(queryByText('This offer has expired and can no longer be accepted.')).toBeNull();
  });

  it('describes a completed trade as complete', async () => {
    mockTrades(makeOffer('completed'));
    const { findByText, queryByText } = render(<ReviewOfferScreen />);

    expect(await findByText('You accepted this offer — this trade is complete.')).toBeTruthy();
    expect(queryByText('This offer has expired and can no longer be accepted.')).toBeNull();
  });

  it('keeps the expiry wording ONLY for a genuine expiry', async () => {
    mockTrades(makeOffer('cancelled', { cancellation_reason: 'Offer expired' }));
    const { findByText } = render(<ReviewOfferScreen />);

    expect(await findByText('This offer has expired and can no longer be accepted.')).toBeTruthy();
  });

  it('uses role-appropriate copy for a seller decline (never the raw reason code)', async () => {
    mockTrades(makeOffer('cancelled', { cancellation_reason: 'seller_declined' }));
    const { findByText, queryByText } = render(<ReviewOfferScreen />);

    expect(await findByText('You declined this offer.')).toBeTruthy();
    expect(queryByText(/seller_declined/)).toBeNull();
  });

  it('explains a payment failure instead of claiming expiry', async () => {
    mockTrades(makeOffer('payment_failed'));
    const { findByText } = render(<ReviewOfferScreen />);

    expect(
      await findByText("This offer couldn't be completed because the payment failed.")
    ).toBeTruthy();
  });

  it('still shows the accept/decline actions for a pending offer', async () => {
    mockTrades(makeOffer('pending'));
    const { findByTestId, queryByTestId } = render(<ReviewOfferScreen />);

    expect(await findByTestId('accept-trade-button')).toBeTruthy();
    expect(queryByTestId('decline-trade-button')).toBeTruthy();
    expect(queryByTestId('review-offer-status-message')).toBeNull();
  });

  it('banner and CTA agree once a sibling has been accepted (3 pending of 4)', async () => {
    const offer = makeOffer('pending', { bundle_id: 'bundle-1' });
    mockTrades(offer, [
      makeOffer('in_progress', { id: 'sibling-accepted', bundle_id: 'bundle-1' }),
      makeOffer('pending', { id: 'sibling-b', bundle_id: 'bundle-1' }),
      makeOffer('pending', { id: 'sibling-c', bundle_id: 'bundle-1' }),
    ]);

    const { findByText, queryByText } = render(<ReviewOfferScreen />);

    expect(await findByText('Bundle offer · 3 items')).toBeTruthy();
    expect(await findByText('Accept All 3 Items')).toBeTruthy();
    expect(await findByText('1 already accepted')).toBeTruthy();
    expect(queryByText('Bundle offer · 4 items')).toBeNull();
  });

  it('banner and CTA agree on a 2-item bundle', async () => {
    const offer = makeOffer('pending', { bundle_id: 'bundle-1' });
    mockTrades(offer, [makeOffer('pending', { id: 'sibling-b', bundle_id: 'bundle-1' })]);

    const { findByText, queryByText } = render(<ReviewOfferScreen />);

    expect(await findByText('Bundle offer · 2 items')).toBeTruthy();
    expect(await findByText('Accept All 2 Items')).toBeTruthy();
    expect(queryByText('1 already accepted')).toBeNull();
  });

  it('offers a route to the remaining siblings after one is accepted', async () => {
    const offer = makeOffer('in_progress', { bundle_id: 'bundle-1' });
    mockTrades(offer, [
      makeOffer('pending', { id: 'sibling-b', bundle_id: 'bundle-1' }),
      makeOffer('pending', { id: 'sibling-c', bundle_id: 'bundle-1' }),
    ]);

    const { findByTestId } = render(<ReviewOfferScreen />);
    const link = await findByTestId('review-other-siblings-link');

    fireEvent.press(link);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('ReviewOffer', { tradeId: 'sibling-b' });
    });
  });

  it('shows no sibling route when nothing else is pending', async () => {
    mockTrades(makeOffer('in_progress', { bundle_id: 'bundle-1' }), [
      makeOffer('completed', { id: 'sibling-b', bundle_id: 'bundle-1' }),
    ]);

    const { findByTestId, queryByTestId } = render(<ReviewOfferScreen />);

    expect(await findByTestId('review-offer-status-message')).toBeTruthy();
    expect(queryByTestId('review-other-siblings-link')).toBeNull();
  });
});

/**
 * FIX-Task-27 item 4 (2026-09-13) — the `offer_load_stall` QA toggle.
 *
 * FIX-Task-26 item 5 bounded this screen's offer read at 20s, but the
 * timeout→retry branch was only reachable through a REAL stall (staging was
 * healthy during review), so it stayed unit-test-only. The toggle makes the read
 * never settle.
 *
 * This test pins the INJECTION — an armed stall must short-circuit BEFORE the
 * query is issued, so no request is sent and no server load is added. The 20s
 * firing + retry card is the on-device leg recorded in the FIX-Task-27 report.
 */
describe('ReviewOfferScreen — qa offer_load_stall toggle (FIX-Task-27 item 4)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockUseAuth.mockReturnValue({ session: { user: { id: 'seller-1' } } } as any);
  });

  it('armed: the stall trips the 20s bound and surfaces the retryable error state', async () => {
    // Fake timers so the REAL 20s bound can be reached without waiting for it.
    jest.useFakeTimers();
    try {
      await setQaLocalValue(QA_OFFER_LOAD_STALL_KEY, 'stall');
      // Precondition: the toggle really is armed for this suite's module instance.
      expect(await getSimulatedOfferLoadStall()).toBe('stall');
      mockTrades(makeOffer('pending'));

      const { queryByTestId } = render(<ReviewOfferScreen />);

      // Let the mount effect reach — and enter — the stalled read.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Still stalled: nothing from the offer body has rendered and the bound has
      // not elapsed, so there is no error state yet.
      expect(queryByTestId('accept-trade-button')).toBeNull();
      expect(queryByTestId('review-offer-load-error')).toBeNull();

      // Trip the bound.
      await act(async () => {
        jest.advanceTimersByTime(20001);
      });

      expect(queryByTestId('review-offer-load-error')).toBeTruthy();
      expect(queryByTestId('review-offer-retry-button')).toBeTruthy();

      // NOTE: `supabase.from` call counts are NOT a valid signal here — this
      // screen's ScreenLayout header runs an unrelated unread-message badge query
      // against `trades` (useUnreadMessagesBadge → services/chat.ts), so the stall
      // is asserted through the render state instead.
    } finally {
      jest.useRealTimers();
    }
  });

  it('disarmed: the offer read runs normally and the offer renders', async () => {
    await setQaLocalValue(QA_OFFER_LOAD_STALL_KEY, 'none');
    mockTrades(makeOffer('pending'));

    const { findByTestId } = render(<ReviewOfferScreen />);

    expect(await findByTestId('accept-trade-button')).toBeTruthy();
  });
});

/**
 * FIX-Task-28 item 8 (2026-09-13): the 20s bound left the seller on a bare spinner
 * with nothing changing on screen — which reads as a frozen app. After ~8s the
 * screen acknowledges the slowness and offers the error state's escape hatch.
 */
describe('ReviewOfferScreen — slow-load affordance (FIX-Task-28 item 8)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockUseAuth.mockReturnValue({ session: { user: { id: 'seller-1' } } } as any);
  });

  it('shows the hint at 8s but not before, and does not auto-retry', async () => {
    jest.useFakeTimers();
    try {
      await setQaLocalValue(QA_OFFER_LOAD_STALL_KEY, 'stall');
      expect(await getSimulatedOfferLoadStall()).toBe('stall');
      mockTrades(makeOffer('pending'));

      const { queryByTestId } = render(<ReviewOfferScreen />);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // The bare spinner is fine for the first few seconds — no hint yet.
      expect(queryByTestId('review-offer-slow-hint')).toBeNull();

      // Cross the 8s threshold.
      await act(async () => {
        jest.advanceTimersByTime(8001);
      });

      expect(queryByTestId('review-offer-slow-hint')).toBeTruthy();
      expect(queryByTestId('review-offer-slow-back-button')).toBeTruthy();

      // The hard bound has NOT fired and nothing was retried automatically.
      expect(queryByTestId('review-offer-load-error')).toBeNull();
      expect(queryByTestId('review-offer-retry-button')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
