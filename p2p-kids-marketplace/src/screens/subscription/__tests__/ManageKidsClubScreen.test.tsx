/**
 * Unit Tests: ManageKidsClubScreen — FIX-Task-47 item 1 (2026-09-16)
 *
 * The screen computed its billing date as
 *   `subscription.subscription_expires_at || subscription.trial_ends_at`
 * — omitting `next_billing_date` entirely. Staging leaves
 * `subscription_expires_at` unpopulated for active members, so an ACTIVE
 * subscriber was shown a STALE trial-end date as "Next Billing Date" (and as
 * "Access Until" once cancelled), while the app's own My Subscription screen
 * showed the correct `next_billing_date`. Because the stale date was in the
 * past, `daysRemaining` returned 0 and the "Days Remaining" row never rendered.
 *
 * Both screens now render `getSubscriptionPeriodEnd()` (see
 * `services/__tests__/subscription.test.ts` for the precedence cases). This file
 * guards the SCREEN wiring: the rendered row must show `next_billing_date`, the
 * stale trial date must be absent, and the days row must be visible again.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ManageKidsClubScreen from '../ManageKidsClubScreen';
import { getSubscriptionSummary } from '@/services/subscription';
import { getGracePeriodDays, getActiveMemberFeeCents } from '@/services/adminConfig';

const mockStableNavigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockStableNavigation,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The screen reads `session.user.id` straight off AuthContext.
jest.mock('@/contexts/AuthContext', () => {
  const ReactLib = require('react');
  return {
    AuthContext: ReactLib.createContext({
      session: { user: { id: 'user-1' } },
      refreshSession: jest.fn(),
    }),
  };
});

jest.mock('@/services/errorReporter', () => ({ captureException: jest.fn() }));

// Keep the REAL `getSubscriptionPeriodEnd` (the thing under test) and stub only
// the reads. BP-94: mirror every export the screen (or its children) consumes.
jest.mock('@/services/subscription', () => ({
  ...jest.requireActual('@/services/subscription'),
  getSubscriptionSummary: jest.fn(),
  cancelSubscription: jest.fn(),
  getPaymentMethod: jest.fn(),
  resubscribe: jest.fn(),
  updateAutoRenew: jest.fn(),
}));

jest.mock('@/services/adminConfig', () => ({
  getGracePeriodDays: jest.fn(),
  getActiveMemberFeeCents: jest.fn(),
}));

jest.mock('@/components/subscription/PaymentMethodSection', () => ({
  PaymentMethodSection: () => null,
}));
jest.mock('@/components/subscription/AutoRenewToggle', () => ({ AutoRenewToggle: () => null }));
jest.mock('@/components/subscription/BillingHistoryLink', () => ({ BillingHistoryLink: () => null }));
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

// Keep the dates relative to "now" so the assertion can never rot into a
// past-date flake (the days row legitimately disappears once the date passes).
const REAL_NEXT_BILLING = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const STALE_TRIAL_END = '2026-07-27T12:00:00.000Z';

// Must match the screen's own formatter so the expectation is timezone-safe.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const ACTIVE_SUMMARY = {
  status: 'active',
  is_subscriber: true,
  can_earn_sp: true,
  can_spend_sp: true,
  transaction_fee_cents: 149,
  subscription_tier_id: 'tier-1',
  tier_name: 'Kids Club+',
  // Staging reality: the trial-derived field holds a stale date ...
  subscription_expires_at: STALE_TRIAL_END,
  trial_ends_at: STALE_TRIAL_END,
  grace_ends_at: null,
  // ... while this is the true renewal date.
  next_billing_date: REAL_NEXT_BILLING,
  cancelled_at: null,
  paused_until: null,
  has_used_trial: true,
  auto_renew_enabled: true,
  payment_retry_count: 0,
  payment_failed_at: null,
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  stripe_payment_method_id: 'pm_1',
};

describe('ManageKidsClubScreen — FIX-Task-47 item 1 (billing date)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSubscriptionSummary as jest.Mock).mockResolvedValue(ACTIVE_SUMMARY);
    (getGracePeriodDays as jest.Mock).mockResolvedValue(90);
    (getActiveMemberFeeCents as jest.Mock).mockResolvedValue(149);
  });

  it('renders next_billing_date, NOT the stale trial-end date', async () => {
    const { getByText, queryByText } = render(<ManageKidsClubScreen />);

    await waitFor(() => expect(getByText('Next Billing Date')).toBeTruthy());

    // The fix: the true renewal date is shown ...
    expect(getByText(formatDate(REAL_NEXT_BILLING))).toBeTruthy();
    // ... and the stale trial date is nowhere on the screen (pre-fix this is
    // exactly what rendered, so this is the discriminating assertion).
    expect(queryByText(formatDate(STALE_TRIAL_END))).toBeNull();
  });

  it('renders the "Days Remaining" row again (it was hidden by the stale date)', async () => {
    const { getByText } = render(<ManageKidsClubScreen />);

    await waitFor(() => expect(getByText('Days Remaining')).toBeTruthy());
  });

  it('shows the plain-language billing helper line (item 10)', async () => {
    const { getByTestId } = render(<ManageKidsClubScreen />);

    await waitFor(() =>
      expect(getByTestId('manage-kids-club-billing-helper')).toBeTruthy()
    );
  });
});
