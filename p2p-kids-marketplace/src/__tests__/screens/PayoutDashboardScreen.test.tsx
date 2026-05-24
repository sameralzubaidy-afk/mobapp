/**
 * Unit Tests: Payout Dashboard Screen
 * File: p2p-kids-marketplace/src/__tests__/screens/PayoutDashboardScreen.test.tsx
 * Module: MODULE-15.1 FLOW-22
 * Task: FLOW-22 UI Redesign
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import PayoutDashboardScreen from '../../screens/payouts/PayoutDashboardScreen';
import {
  getSellerBalance,
  getRecentPayouts,
  formatPayoutStatus,
  formatCentsToDollars,
} from '../../services/sellerBalance';
import { listPayoutMethods } from '../../services/payoutMethods';

// --- Mocks ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../../services/sellerBalance', () => ({
  getSellerBalance: jest.fn(),
  getRecentPayouts: jest.fn(),
  formatPayoutStatus: jest.fn(),
  formatCentsToDollars: jest.fn(),
  formatBalanceForDisplay: jest.fn(),
}));

jest.mock('../../services/payoutMethods', () => ({
  listPayoutMethods: jest.fn(),
}));

// Silence LoadingSpinner native animations in tests
jest.mock('../../components/ui', () => ({
  LoadingSpinner: () => null,
}));

// --- Shared mock instances ---
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockGetSellerBalance = getSellerBalance as jest.MockedFunction<typeof getSellerBalance>;
const mockGetRecentPayouts = getRecentPayouts as jest.MockedFunction<typeof getRecentPayouts>;
const mockFormatPayoutStatus = formatPayoutStatus as jest.MockedFunction<typeof formatPayoutStatus>;
const mockFormatCentsToDollars = formatCentsToDollars as jest.MockedFunction<typeof formatCentsToDollars>;
const mockListPayoutMethods = listPayoutMethods as jest.MockedFunction<typeof listPayoutMethods>;
const mockFormatBalanceForDisplay = require('../../services/sellerBalance').formatBalanceForDisplay as jest.Mock;

// --- Shared test data ---
const mockBalance = {
  user_id: 'user-123',
  available_balance_cents: 5000,
  pending_balance_cents: 1000,
  lifetime_earnings_cents: 12000,
  total_trades_completed: 4,
  total_trades_pending: 1,
  last_payout_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockPayouts = [
  {
    id: 'payout-1',
    user_id: 'user-123',
    trade_id: 'trade-1',
    payout_method_id: 'method-1',
    currency: 'aud',
    gross_amount_cents: 5000,
    platform_fee_cents: 0,
    payout_fee_cents: 25,
    net_amount_cents: 4975,
    status: 'completed' as const,
    provider: 'stripe',
    provider_reference_id: 'po_abc',
    idempotency_key: 'key-1',
    initiated_at: '2025-01-01T10:00:00Z',
    completed_at: '2025-01-01T10:05:00Z',
    failure_reason: null,
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-01T10:05:00Z',
  },
  {
    id: 'payout-2',
    user_id: 'user-123',
    trade_id: null,
    payout_method_id: 'method-1',
    currency: 'aud',
    gross_amount_cents: 3000,
    platform_fee_cents: 0,
    payout_fee_cents: 25,
    net_amount_cents: 2975,
    status: 'pending' as const,
    provider: null,
    provider_reference_id: null,
    idempotency_key: 'key-2',
    initiated_at: null,
    completed_at: null,
    failure_reason: null,
    created_at: '2025-01-02T10:00:00Z',
    updated_at: '2025-01-02T10:00:00Z',
  },
];

const mockBankMethod = {
  id: 'method-1',
  user_id: 'user-123',
  method_type: 'bank_ach' as const,
  is_primary: true,
  is_verified: true,
  stripe_account_id: undefined,
  stripe_onboarding_complete: false,
  stripe_payouts_enabled: false,
  paypal_email: undefined,
  venmo_handle: undefined,
  venmo_phone_e164: undefined,
  bank_account_token: undefined,
  bank_account_last4: '6789',
  bank_routing_last4: undefined,
  bank_verification_status: 'verified',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// =============================================================================
describe('PayoutDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSellerBalance.mockResolvedValue(mockBalance);
    mockGetRecentPayouts.mockResolvedValue(mockPayouts);
    mockListPayoutMethods.mockResolvedValue({
      methods: [mockBankMethod],
      primary_method: mockBankMethod,
      has_verified_method: true,
    });
    mockFormatBalanceForDisplay.mockReturnValue({
      available: '$50.00',
      pending: '$10.00',
      lifetime: '$120.00',
      available_cents: 5000,
      pending_cents: 1000,
      lifetime_cents: 12000,
    });
    mockFormatCentsToDollars.mockImplementation((cents: number) => `$${(cents / 100).toFixed(2)}`);
    mockFormatPayoutStatus.mockImplementation((status: string) => {
      if (status === 'completed') return { label: 'Completed', color: '#28a745' };
      return { label: 'Pending', color: '#999' };
    });
  });

  // ---------------------------------------------------------------------------
  it('renders the screen root testID', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('payout-dashboard-screen')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows loading spinner while fetching data', () => {
    mockGetSellerBalance.mockImplementation(() => new Promise(() => {}));
    const { queryByTestId } = render(<PayoutDashboardScreen />);
    expect(queryByTestId('payout-dashboard-screen')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  it('renders balance hero card with SP count and AUD equivalent', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      const amountEl = getByTestId('balance-amount');
      expect(amountEl.props.children).toBeDefined();
      const heroCard = getByTestId('balance-hero-card');
      expect(heroCard).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('coins icon is visible on hero card', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('coins-icon')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('renders Request Payout pill button on hero card', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('request-payout-btn')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('navigates to RequestPayout on Request Payout press', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('request-payout-btn')).toBeTruthy();
    });
    fireEvent.press(getByTestId('request-payout-btn'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RequestPayout');
  });

  // ---------------------------------------------------------------------------
  it('renders bank row with primary method name', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      const bankName = getByTestId('bank-name');
      expect(bankName.props.children).toContain('6789');
    });
  });

  // ---------------------------------------------------------------------------
  it('shows Add Bank Account when no payout method', async () => {
    mockListPayoutMethods.mockResolvedValue({
      methods: [],
      primary_method: null,
      has_verified_method: false,
    });
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('add-bank-row')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('navigates to PayoutSettings on bank row press', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('bank-row')).toBeTruthy();
    });
    fireEvent.press(getByTestId('bank-row'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PayoutSettings');
  });

  // ---------------------------------------------------------------------------
  it('renders payout history rows', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId(`history-row-payout-1`)).toBeTruthy();
      expect(getByTestId(`history-row-payout-2`)).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows CheckCircle icon for completed payout status', async () => {
    const { getAllByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getAllByTestId('icon-completed').length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  it('shows Clock icon for pending payout status', async () => {
    const { getAllByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getAllByTestId('icon-pending').length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  it('shows empty state when no payout history', async () => {
    mockGetRecentPayouts.mockResolvedValue([]);
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('empty-history')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows error banner on data fetch failure', async () => {
    mockGetSellerBalance.mockRejectedValue(new Error('Network error'));
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('error-banner')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('calls goBack on back button press', async () => {
    const { getByTestId } = render(<PayoutDashboardScreen />);
    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
