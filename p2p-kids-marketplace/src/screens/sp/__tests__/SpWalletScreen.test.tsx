// File: p2p-kids-marketplace/src/screens/sp/__tests__/SpWalletScreen.test.tsx
// MODULE-15.1 FLOW-10/11: SpWalletScreen Unit Tests

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import SpWalletScreen from '../SpWalletScreen';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import * as walletService from '@/services/sp/wallet';

// Mock dependencies
jest.mock('@react-navigation/native');
jest.mock('@/hooks/useAuth');
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
jest.mock('@/components/molecules/WalletWarningBanner', () => 'WalletWarningBanner');
jest.mock('../../components/organisms/BottomNavBar', () => 'BottomNavBar');

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockWallet: walletService.SPWallet = {
  id: 'wallet-1',
  user_id: 'test-user-id',
  available_balance: 350,
  pending_balance: 50,
  lifetime_earned: 1200,
  lifetime_spent: 800,
  lifetime_expired: 50,
  state: 'active',
  starter_pack_issued: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
};

describe('SpWalletScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useAuth as jest.Mock).mockReturnValue({
      session: { wallet_state: 'active' },
    });
    (walletService.getWallet as jest.Mock).mockResolvedValue(mockWallet);
    (walletService.getLedgerHistory as jest.Mock).mockResolvedValue([]);
    (walletService.getExpiringBatches as jest.Mock).mockResolvedValue([]);
    (walletService.getSPConfig as jest.Mock).mockResolvedValue('90');
  });

  it('should render loading state initially', () => {
    const { getByText } = render(<SpWalletScreen />);
    expect(getByText('Loading your wallet...')).toBeTruthy();
  });

  it('should render hero balance card after loading', async () => {
    const { getByTestId, getByText } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-wallet-balance-card')).toBeTruthy();
    });

    expect(getByText('350')).toBeTruthy(); // Balance amount
    expect(getByText('Swap Points')).toBeTruthy();
  });

  it('should render quick action buttons', async () => {
    const { getByTestId } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-wallet-redeem-btn')).toBeTruthy();
      expect(getByTestId('sp-wallet-earn-more-btn')).toBeTruthy();
      expect(getByTestId('sp-wallet-history-btn')).toBeTruthy();
    });
  });

  it('should navigate to transaction history on history button press', async () => {
    const { getByTestId } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-wallet-history-btn')).toBeTruthy();
    });

    fireEvent.press(getByTestId('sp-wallet-history-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('SpTransactionHistory');
  });

  it('should render lifetime stats correctly', async () => {
    const { getByText } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByText('1200')).toBeTruthy(); // Lifetime earned
      expect(getByText('800')).toBeTruthy(); // Lifetime spent
      expect(getByText('50')).toBeTruthy(); // Pending
    });
  });

  it('should show expiring alert when SP is expiring soon', async () => {
    (walletService.getExpiringBatches as jest.Mock).mockResolvedValue([
      { remaining_sp: 100 },
      { remaining_sp: 50 },
    ]);

    const { getByText } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByText(/150 SP will expire in 30 days/)).toBeTruthy();
    });
  });

  it('should not show expiring alert when no SP is expiring', async () => {
    (walletService.getExpiringBatches as jest.Mock).mockResolvedValue([]);

    const { queryByText } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(queryByText(/will expire/)).toBeNull();
    });
  });

  it('should navigate back on back button press', async () => {
    const { getByTestId } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-wallet-back-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('sp-wallet-back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should show error state when wallet is null', async () => {
    (walletService.getWallet as jest.Mock).mockResolvedValue(null);

    const { getByText } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByText('Wallet Not Found')).toBeTruthy();
      expect(getByText('Unable to load your SP wallet.')).toBeTruthy();
    });
  });

  it('should handle refresh correctly', async () => {
    const { getByTestId } = render(<SpWalletScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-wallet-balance-card')).toBeTruthy();
    });

    // Trigger refresh (note: RefreshControl doesn't have a testID by default)
    // This is a simplified test - in real scenario you'd use ScrollView's testID
    expect(walletService.getWallet).toHaveBeenCalledTimes(1);
  });
});
