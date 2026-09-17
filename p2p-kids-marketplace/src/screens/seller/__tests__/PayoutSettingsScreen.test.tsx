/**
 * Unit Tests: PayoutSettingsScreen — FIX-Task-46 (2026-09-16, owner-approved)
 *
 * Item A — the load had no deadline on ANY leg, so on a degraded connection the
 *   seller watched a bare spinner with no data, no message and no way forward
 *   (measured: 84s / 138s on the Android emulator vs ~2.5s for the identical
 *   chain from the host — see the FIX-Task-46 handoff). The whole chain is now
 *   bounded by `LOAD_DEADLINE_MS`, and a timed-out load renders an inline notice
 *   with a retry instead of a blocking alert.
 *
 * Item A (withhold) — the hero used `?? '$0.00'`, which is not a neutral default:
 *   it told a funded seller they had nothing (BP-92 rule 3). Figures are now
 *   withheld (`—`) and the Withdraw control is not actionable until a real
 *   `SellerBalance` has landed.
 *
 * Item B — `lastAutoReloadAtRef` started at 0, so `now - 0 < 1500` could never
 *   hold on the first entry and the focus effect fired a SECOND identical load on
 *   every mount, contradicting the DT-124 comment that claims it is coalesced.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import PayoutSettingsScreen from '../PayoutSettingsScreen';
import { listPayoutMethods, checkPayoutEligibility } from '@/services/payoutMethods';
import {
  getSellerBalance,
  getRecentPayouts,
  getActionRequiredPayoutCount,
} from '@/services/sellerBalance';
import { getAdminPayoutConfig } from '@/services/payoutRouter';
import { getSimulatedPayoutLoadStall } from '@/services/devTestingService';

// STABLE navigation object: the screen's focus effect depends on `navigation`
// through a `useCallback`, so a fresh object per render would re-create it and
// the mocked focus effect would re-subscribe forever (BP-93).
const mockStableNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockStableNavigation,
  // Invoke the focus callback the way the real hook does, so mount-vs-focus
  // behaviour is actually exercised (a bare auto-mock would hide item B).
  useFocusEffect: (cb: () => void | (() => void)) => {
    const ReactLib = require('react');
    ReactLib.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
}));

jest.mock('@/services/supabase/client', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: null } })) } },
}));
jest.mock('@/services/errorReporter', () => ({ captureException: jest.fn() }));
jest.mock('@/services/devTestingService', () => ({
  getSimulatedPayoutFetchFailure: jest.fn(async () => 'none'),
  // FIX-Task-50 item 5 (BP-94): the screen now also consumes the slow-load toggle —
  // an unlisted export would be `undefined` here and the stall could never arm.
  getSimulatedPayoutLoadStall: jest.fn(async () => 'none'),
}));

// BP-94: mirror every export this screen consumes — an unlisted export is
// `undefined` at call time, and this screen's own try/catch would swallow the
// resulting TypeError into a plausible-looking degraded result.
jest.mock('@/services/payoutMethods', () => ({
  listPayoutMethods: jest.fn(),
  createPayoutMethod: jest.fn(),
  deletePayoutMethod: jest.fn(),
  setPrimaryPayoutMethod: jest.fn(),
  formatPayoutMethodDisplay: jest.fn(() => ({ label: 'Stripe (acct_****0000)' })),
  checkPayoutEligibility: jest.fn(),
  syncStripeConnectStatus: jest.fn(async () => undefined),
  createStripeAccountLinkUrl: jest.fn(async () => ({ url: 'https://connect.example' })),
}));

// Keep the REAL pure formatters so the rendered money strings are produced by the
// shipping code, not by an invented mock shape (BP-88); stub only the reads.
jest.mock('@/services/sellerBalance', () => ({
  ...jest.requireActual('@/services/sellerBalance'),
  getSellerBalance: jest.fn(),
  requestFullWithdrawal: jest.fn(),
  submitPayPalPayout: jest.fn(),
  getRecentPayouts: jest.fn(),
  getActionRequiredPayoutCount: jest.fn(),
}));

jest.mock('@/services/payoutRouter', () => ({ getAdminPayoutConfig: jest.fn() }));

jest.mock('@/components/ui', () => ({ LoadingSpinner: () => null }));
jest.mock('@/components/ScreenLayout', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) =>
      ReactLib.createElement(View, null, children),
  };
});
jest.mock('@/components/shared/KeyboardDoneAccessory', () => ({
  KEYBOARD_DONE_ACCESSORY_ID: 'qa-keyboard-done-accessory',
  KeyboardDoneAccessory: () => null,
}));
jest.mock('phosphor-react-native', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Icon = () => ReactLib.createElement(View, null);
  return {
    Coins: Icon,
    Bank: Icon,
    ArrowDown: Icon,
    Plus: Icon,
    CheckCircle: Icon,
    Clock: Icon,
    Check: Icon,
    DotsThree: Icon,
    CurrencyDollar: Icon,
    CreditCard: Icon,
    PencilSimple: Icon,
    Trash: Icon,
  };
});

const ZERO_BALANCE = {
  user_id: 'seller-1',
  available_balance_cents: 0,
  pending_balance_cents: 0,
  lifetime_earnings_cents: 0,
};

const ADMIN_PAYOUT_CONFIG = {
  enable_automatic_seller_payout: false,
  minimum_withdrawal_amount_cents: 500,
  stripe_payout_fee_fixed_cents: 25,
  stripe_payout_fee_percentage: 0.25,
  paypal_payout_fee_percentage: 2,
  paypal_payout_fee_cap_cents: 2000,
};

describe('PayoutSettingsScreen — FIX-Task-46', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listPayoutMethods as jest.Mock).mockResolvedValue({
      methods: [],
      primary_method: null,
      has_verified_method: false,
    });
    (checkPayoutEligibility as jest.Mock).mockResolvedValue({
      can_receive_payouts: false,
      has_verified_method: false,
      primary_method: null,
      blocking_reason: 'No verified payout method configured',
    });
    (getSellerBalance as jest.Mock).mockResolvedValue(ZERO_BALANCE);
    (getRecentPayouts as jest.Mock).mockResolvedValue([]);
    (getActionRequiredPayoutCount as jest.Mock).mockResolvedValue(0);
    (getAdminPayoutConfig as jest.Mock).mockResolvedValue(ADMIN_PAYOUT_CONFIG);
  });

  it('item B: mounting performs exactly ONE load (mount + focus are coalesced)', async () => {
    render(<PayoutSettingsScreen />);
    await waitFor(() => expect(listPayoutMethods).toHaveBeenCalled());

    // Before the fix `lastAutoReloadAtRef` was 0, so the focus effect's reload
    // always slipped past the 1.5s window and this was 2.
    expect(listPayoutMethods).toHaveBeenCalledTimes(1);
    expect(checkPayoutEligibility).toHaveBeenCalledTimes(1);
  });

  it('item A: a load that never settles trips the deadline and withholds the balance', async () => {
    jest.useFakeTimers();
    try {
      // A read that is issued but never settles — the stalled-socket case.
      (listPayoutMethods as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const { queryByTestId, getByTestId } = render(<PayoutSettingsScreen />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Still inside the deadline: no notice, and no data painted yet.
      expect(queryByTestId('payout-load-degraded-notice')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(20001);
      });

      // Degraded-but-usable rather than a bare spinner forever.
      expect(getByTestId('payout-load-degraded-notice')).toBeTruthy();
      expect(getByTestId('payout-load-retry-btn')).toBeTruthy();
      // …and the copy tells the truth about the withheld balance.
      expect(String(getByTestId('payout-load-degraded-text').props.children)).toContain(
        'stays hidden'
      );

      // The money figures are withheld, never faked as $0.00 (BP-92).
      expect(getByTestId('balance-amount').props.children).toBe('—');
      expect(getByTestId('balance-pending').props.children).toBe('—');
      expect(getByTestId('balance-lifetime').props.children).toBe('—');
      // …so the "nothing to withdraw" hint is also withheld.
      expect(queryByTestId('no-balance-hint')).toBeNull();
      // …and the withdrawal cannot be submitted against an unknown amount.
      expect(getByTestId('request-payout-btn').props.accessibilityState).toEqual({
        disabled: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('item A: "Try again" clears the notice and re-runs the load', async () => {
    jest.useFakeTimers();
    try {
      (listPayoutMethods as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const { queryByTestId, getByTestId } = render(<PayoutSettingsScreen />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(20001);
      });
      expect(getByTestId('payout-load-degraded-notice')).toBeTruthy();

      fireEvent.press(getByTestId('payout-load-retry-btn'));
      await act(async () => {
        await Promise.resolve();
      });

      expect(queryByTestId('payout-load-degraded-notice')).toBeNull();
      // A second attempt was started (the first one is still stalled in the dark).
      expect(listPayoutMethods).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('item 5 (FIX-Task-50): the payout_load_stall toggle reaches the degraded state with NO network call', async () => {
    jest.useFakeTimers();
    try {
      (getSimulatedPayoutLoadStall as jest.Mock).mockResolvedValue('stall');

      const { queryByTestId, getByTestId } = render(<PayoutSettingsScreen />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Still inside the deadline: nothing painted, no notice.
      expect(queryByTestId('payout-load-degraded-notice')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(20001);
      });

      // The SAME degraded-but-usable state the slow-socket case produces.
      expect(getByTestId('payout-load-degraded-notice')).toBeTruthy();
      expect(getByTestId('payout-load-retry-btn')).toBeTruthy();
      expect(getByTestId('balance-amount').props.children).toBe('—');
      expect(getByTestId('balance-pending').props.children).toBe('—');
      // …and the stall short-circuits BEFORE the first leg, so no request is sent.
      expect(listPayoutMethods).not.toHaveBeenCalled();
    } finally {
      // clearAllMocks() clears calls but NOT implementations, so disarm explicitly
      // or the next test inherits the stall (BP-94).
      (getSimulatedPayoutLoadStall as jest.Mock).mockResolvedValue('none');
      jest.useRealTimers();
    }
  });

  it('a loaded zero balance still shows $0.00 + the hint and an ENABLED Withdraw (SUB-TC-H01 guard)', async () => {
    const { getByTestId, queryByTestId } = render(<PayoutSettingsScreen />);

    await waitFor(() => expect(getByTestId('balance-amount').props.children).toBe('$0.00'));

    // A real server-side $0.00 is NOT withheld — only an unknown balance is.
    expect(getByTestId('balance-pending').props.children).toBe('$0.00');
    expect(getByTestId('no-balance-hint')).toBeTruthy();
    // H01 still expects the "No Balance" alert on tap, so the control stays live.
    expect(getByTestId('request-payout-btn').props.accessibilityState).toEqual({
      disabled: false,
    });
    expect(queryByTestId('payout-load-degraded-notice')).toBeNull();
  });

  it('a funded balance is rendered from the server value, never as $0.00', async () => {
    (getSellerBalance as jest.Mock).mockResolvedValue({
      ...ZERO_BALANCE,
      available_balance_cents: 90940,
      pending_balance_cents: 117760,
      lifetime_earnings_cents: 208700,
    });

    const { getByTestId, queryByTestId } = render(<PayoutSettingsScreen />);

    await waitFor(() => expect(getByTestId('balance-amount').props.children).toBe('$909.40'));
    // `formatCentsToDollars` renders `$<dollars>.<cents>` with no thousands separator.
    expect(getByTestId('balance-pending').props.children).toBe('$1177.60');
    expect(getByTestId('balance-lifetime').props.children).toBe('$2087.00');
    expect(queryByTestId('no-balance-hint')).toBeNull();
  });

  // ── FIX-Task-47 items 3 + 11: Load More must disappear on the last page ──────
  // The button used to render whenever ANY row existed, so at the last page it
  // stayed visible and did nothing when tapped (SUB-TC-F08 FAIL on Android).

  const payoutRow = (n: number) => ({
    id: `payout-${n}`,
    user_id: 'seller-1',
    trade_id: `trade-${n}`,
    gross_amount_cents: 1000,
    platform_fee_cents: 50,
    payout_fee_cents: 0,
    net_amount_cents: 950,
    status: 'completed',
    provider: 'stripe',
    provider_reference_id: null,
    idempotency_key: `key-${n}`,
    failure_reason: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  });

  it('item 3: shows Load More when the server holds more rows than the page', async () => {
    // 6 rows for a 5-row page (the +1 probe) ⇒ more remain.
    (getRecentPayouts as jest.Mock).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => payoutRow(i))
    );

    const { getByTestId, queryByTestId, queryAllByTestId } = render(<PayoutSettingsScreen />);

    await waitFor(() => expect(getByTestId('load-more-button')).toBeTruthy());
    // The probe row proves `hasMore` but is never displayed.
    expect(queryAllByTestId(/^history-row-/)).toHaveLength(5);
    expect(queryByTestId('payout-history-end')).toBeNull();
    // The initial load asks for page + 1.
    expect(getRecentPayouts).toHaveBeenCalledWith(6);
  });

  it('item 3 + 11: on the last page the button is gone and the end state shows', async () => {
    (getRecentPayouts as jest.Mock).mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => payoutRow(i))
    );

    const { getByTestId, queryByTestId } = render(<PayoutSettingsScreen />);

    await waitFor(() => expect(getByTestId('payout-history-end')).toBeTruthy());
    expect(queryByTestId('load-more-button')).toBeNull();
  });
});
