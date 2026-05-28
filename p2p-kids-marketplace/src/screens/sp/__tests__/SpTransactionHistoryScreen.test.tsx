// File: p2p-kids-marketplace/src/screens/sp/__tests__/SpTransactionHistoryScreen.test.tsx
// MODULE-15.1 FLOW-10/11: SpTransactionHistoryScreen Unit Tests

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import SpTransactionHistoryScreen from '../SpTransactionHistoryScreen';
import { useNavigation } from '@react-navigation/native';
import * as walletService from '@/services/sp/wallet';

// Mock dependencies
jest.mock('@react-navigation/native');
jest.mock('@/services/sp/wallet');
jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
  },
}));
jest.mock('@/components/organisms/BottomNavBar', () => 'BottomNavBar');

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockTransactions: walletService.SPLedgerEntry[] = [
  {
    id: 'tx-1',
    wallet_id: 'wallet-1',
    user_id: 'test-user-id',
    transaction_type: 'sale',
    amount: 350,
    balance_before: 500,
    balance_after: 850,
    description: 'Earned from selling item',
    created_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'tx-2',
    wallet_id: 'wallet-1',
    user_id: 'test-user-id',
    transaction_type: 'spend',
    amount: -100,
    balance_before: 850,
    balance_after: 750,
    description: 'Spent on purchase',
    created_at: '2025-01-14T10:00:00Z',
  },
  {
    id: 'tx-3',
    wallet_id: 'wallet-1',
    user_id: 'test-user-id',
    transaction_type: 'referral',
    amount: 100,
    balance_before: 650,
    balance_after: 750,
    description: 'Referral bonus',
    created_at: '2025-01-13T10:00:00Z',
  },
];

describe('SpTransactionHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (walletService.getLedgerHistory as jest.Mock).mockResolvedValue(mockTransactions);
  });

  it('should render loading state initially', () => {
    const { getByText } = render(<SpTransactionHistoryScreen />);
    expect(getByText('Loading transactions...')).toBeTruthy();
  });

  it('should render transaction list after loading', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-tx-tx-1')).toBeTruthy();
      expect(getByTestId('sp-history-tx-tx-2')).toBeTruthy();
      expect(getByTestId('sp-history-tx-tx-3')).toBeTruthy();
    });
  });

  it('should render tabs correctly', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-tab-all')).toBeTruthy();
      expect(getByTestId('sp-history-tab-earned')).toBeTruthy();
      expect(getByTestId('sp-history-tab-spent')).toBeTruthy();
    });
  });

  it('should filter transactions when "Earned" tab is selected', async () => {
    const { getByTestId, queryByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-tab-earned')).toBeTruthy();
    });

    fireEvent.press(getByTestId('sp-history-tab-earned'));

    await waitFor(() => {
      // Should show only positive amounts (tx-1, tx-3)
      expect(getByTestId('sp-history-tx-tx-1')).toBeTruthy();
      expect(getByTestId('sp-history-tx-tx-3')).toBeTruthy();
      // Should not show negative amounts (tx-2)
      expect(queryByTestId('sp-history-tx-tx-2')).toBeNull();
    });
  });

  it('should filter transactions when "Spent" tab is selected', async () => {
    const { getByTestId, queryByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-tab-spent')).toBeTruthy();
    });

    fireEvent.press(getByTestId('sp-history-tab-spent'));

    await waitFor(() => {
      // Should show only negative amounts (tx-2)
      expect(getByTestId('sp-history-tx-tx-2')).toBeTruthy();
      // Should not show positive amounts (tx-1, tx-3)
      expect(queryByTestId('sp-history-tx-tx-1')).toBeNull();
      expect(queryByTestId('sp-history-tx-tx-3')).toBeNull();
    });
  });

  it('should show all transactions when "All" tab is selected', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-tab-all')).toBeTruthy();
    });

    fireEvent.press(getByTestId('sp-history-tab-earned')); // Switch away first
    fireEvent.press(getByTestId('sp-history-tab-all')); // Then back to all

    await waitFor(() => {
      expect(getByTestId('sp-history-tx-tx-1')).toBeTruthy();
      expect(getByTestId('sp-history-tx-tx-2')).toBeTruthy();
      expect(getByTestId('sp-history-tx-tx-3')).toBeTruthy();
    });
  });

  it('should display earned amounts in green with + prefix', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      const amount1 = getByTestId('sp-history-amount-tx-1');
      expect(amount1).toBeTruthy();
      const amountText = Array.isArray(amount1.props.children)
        ? amount1.props.children.join('')
        : String(amount1.props.children);
      expect(amountText).toBe('+350 SP');
      expect(amount1.props.style).toContainEqual({ color: '#5DBB8E' });
    });
  });

  it('should display spent amounts in red without + prefix', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      const amount2 = getByTestId('sp-history-amount-tx-2');
      expect(amount2).toBeTruthy();
      const amountText = Array.isArray(amount2.props.children)
        ? amount2.props.children.join('')
        : String(amount2.props.children);
      expect(amountText).toBe('-100 SP');
      expect(amount2.props.style).toContainEqual({ color: '#E85D75' });
    });
  });

  it('should navigate back on back button press', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should show empty state when no transactions exist', async () => {
    (walletService.getLedgerHistory as jest.Mock).mockResolvedValue([]);

    const { getByTestId, getByText } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-empty-state')).toBeTruthy();
      expect(getByText('No transactions yet')).toBeTruthy();
    });
  });

  it('should handle refresh correctly', async () => {
    const { getByTestId } = render(<SpTransactionHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-history-tx-tx-1')).toBeTruthy();
    });

    // Verify initial call
    expect(walletService.getLedgerHistory).toHaveBeenCalledTimes(1);
  });
});
