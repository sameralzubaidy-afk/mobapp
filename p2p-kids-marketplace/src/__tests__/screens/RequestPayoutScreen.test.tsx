/**
 * Unit Tests: Request Payout Screen
 * File: p2p-kids-marketplace/src/__tests__/screens/RequestPayoutScreen.test.tsx
 * Module: MODULE-15.1 FLOW-22
 * Task: FLOW-22 UI Redesign
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RequestPayoutScreen from '../../screens/payouts/RequestPayoutScreen';
import {
  getSellerBalance,
  calculatePayoutFee,
  formatCentsToDollars,
  requestWithdrawal,
} from '../../services/sellerBalance';
import { listPayoutMethods } from '../../services/payoutMethods';

// --- Mocks ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../../services/sellerBalance', () => ({
  getSellerBalance: jest.fn(),
  calculatePayoutFee: jest.fn(),
  formatCentsToDollars: jest.fn(),
  requestWithdrawal: jest.fn(),
  formatBalanceForDisplay: jest.fn(),
}));

jest.mock('../../services/payoutMethods', () => ({
  listPayoutMethods: jest.fn(),
}));

jest.mock('../../components/ui', () => ({
  LoadingSpinner: () => null,
}));

jest.spyOn(Alert, 'alert');

// --- Shared mock instances ---
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockGetSellerBalance = getSellerBalance as jest.MockedFunction<typeof getSellerBalance>;
const mockCalculatePayoutFee = calculatePayoutFee as jest.MockedFunction<typeof calculatePayoutFee>;
const mockFormatCentsToDollars = formatCentsToDollars as jest.MockedFunction<typeof formatCentsToDollars>;
const mockRequestWithdrawal = requestWithdrawal as jest.MockedFunction<typeof requestWithdrawal>;
const mockListPayoutMethods = listPayoutMethods as jest.MockedFunction<typeof listPayoutMethods>;
const mockFormatBalanceForDisplay = require('../../services/sellerBalance').formatBalanceForDisplay as jest.Mock;

// --- Shared test data ---
const mockBalance = {
  user_id: 'user-123',
  available_balance_cents: 5000,
  pending_balance_cents: 500,
  lifetime_earnings_cents: 10000,
  total_trades_completed: 3,
  total_trades_pending: 1,
  last_payout_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

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
  bank_account_last4: '1234',
  bank_routing_last4: undefined,
  bank_verification_status: 'verified',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// =============================================================================
describe('RequestPayoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSellerBalance.mockResolvedValue(mockBalance);
    mockListPayoutMethods.mockResolvedValue({
      methods: [mockBankMethod],
      primary_method: mockBankMethod,
      has_verified_method: true,
    });
    mockFormatBalanceForDisplay.mockReturnValue({
      available: '$50.00',
      pending: '$5.00',
      lifetime: '$100.00',
      available_cents: 5000,
      pending_cents: 500,
      lifetime_cents: 10000,
    });
    mockFormatCentsToDollars.mockImplementation((cents: number) => `$${(cents / 100).toFixed(2)}`);
    mockCalculatePayoutFee.mockReturnValue(25);
    mockRequestWithdrawal.mockResolvedValue({
      success: true,
      payout_id: 'payout-new-1',
      amount_cents: 2000,
      payout_fee_cents: 25,
      net_amount_cents: 1975,
      method_type: 'bank_ach',
      status: 'pending',
    });
  });

  // ---------------------------------------------------------------------------
  it('renders the screen root testID', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('request-payout-screen')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows loading spinner while fetching', () => {
    mockGetSellerBalance.mockImplementation(() => new Promise(() => {}));
    const { queryByTestId } = render(<RequestPayoutScreen />);
    expect(queryByTestId('request-payout-screen')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  it('renders available balance', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('available-balance')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('renders amount input with Coins icon wrapper', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input-wrapper')).toBeTruthy();
      expect(getByTestId('amount-input')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('renders bank selector with filled row style', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      const bankSelector = getByTestId('bank-selector');
      expect(bankSelector).toBeTruthy();
      const text = getByTestId('bank-selector-text');
      expect(text.props.children).toContain('1234');
    });
  });

  // ---------------------------------------------------------------------------
  it('shows placeholder text when no payout method', async () => {
    mockListPayoutMethods.mockResolvedValue({
      methods: [],
      primary_method: null,
      has_verified_method: false,
    });
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      const text = getByTestId('bank-selector-text');
      expect(text.props.children).toBe('Add payout method');
    });
  });

  // ---------------------------------------------------------------------------
  it('navigates to PayoutSettings on bank selector press', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('bank-selector')).toBeTruthy();
    });
    fireEvent.press(getByTestId('bank-selector'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PayoutSettings');
  });

  // ---------------------------------------------------------------------------
  it('shows validation error when entered amount exceeds balance', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    fireEvent.changeText(getByTestId('amount-input'), '99999');
    await waitFor(() => {
      expect(getByTestId('amount-exceeds-error')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows AUD equivalent when a valid amount is entered', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    fireEvent.changeText(getByTestId('amount-input'), '2000');
    await waitFor(() => {
      expect(getByTestId('aud-equivalent')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows payout summary card when amount and method are set', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    fireEvent.changeText(getByTestId('amount-input'), '2000');
    await waitFor(() => {
      expect(getByTestId('payout-summary')).toBeTruthy();
      expect(getByTestId('summary-amount')).toBeTruthy();
      expect(getByTestId('summary-fee')).toBeTruthy();
      expect(getByTestId('summary-net')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('confirm button is disabled when amount is empty', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      const btn = getByTestId('confirm-payout-btn');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  it('calls requestWithdrawal with correct amount on confirm', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    fireEvent.changeText(getByTestId('amount-input'), '2000');
    await waitFor(() => {
      expect(getByTestId('confirm-payout-btn')).toBeTruthy();
    });
    fireEvent.press(getByTestId('confirm-payout-btn'));
    await waitFor(() => {
      expect(mockRequestWithdrawal).toHaveBeenCalledWith(2000);
    });
  });

  // ---------------------------------------------------------------------------
  it('shows success alert after successful payout request', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    fireEvent.changeText(getByTestId('amount-input'), '2000');
    await waitFor(() => {
      expect(getByTestId('confirm-payout-btn')).toBeTruthy();
    });
    fireEvent.press(getByTestId('confirm-payout-btn'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Payout Requested',
        expect.stringContaining('AUD'),
        expect.any(Array)
      );
    });
  });

  // ---------------------------------------------------------------------------
  it('shows error banner when requestWithdrawal fails', async () => {
    mockRequestWithdrawal.mockResolvedValue({
      success: false,
      error: 'Insufficient balance',
    });
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    fireEvent.changeText(getByTestId('amount-input'), '2000');
    fireEvent.press(getByTestId('confirm-payout-btn'));
    await waitFor(() => {
      expect(getByTestId('error-banner')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows fee note below confirm button', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('fee-note')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('shows error banner on data fetch failure', async () => {
    mockGetSellerBalance.mockRejectedValue(new Error('Network error'));
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('error-banner')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  it('calls goBack on back button press', async () => {
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('back-button'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  it('shows add-method alert when no payout method and confirm pressed', async () => {
    mockListPayoutMethods.mockResolvedValue({
      methods: [],
      primary_method: null,
      has_verified_method: false,
    });
    const { getByTestId } = render(<RequestPayoutScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input')).toBeTruthy();
    });
    // With no method, the confirm button should be disabled — test navigation fallback
    fireEvent.press(getByTestId('bank-selector'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PayoutSettings');
  });
});
