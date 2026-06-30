import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeOfferScreen from '../TradeOfferScreen';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth, useSPWallet, useSubscriptionStatus } from '@/hooks/useAuth';
import { createTradeOfferWithHold } from '@/services/trade';
import { getItemById } from '@/services/items';
import { getAdminConfig } from '@/services/adminConfig';
import { getTransactionFee, getPaymentMethod } from '@/services/subscription';
import { calculateCategorySP } from '@/services/categoryService';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
  useSPWallet: jest.fn(),
  useSubscriptionStatus: jest.fn(),
}));
jest.mock('@/services/trade');
jest.mock('@/services/items');
jest.mock('@/services/adminConfig');
jest.mock('@/services/subscription');
jest.mock('@/services/categoryService');
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(),
  useNavigation: jest.fn(),
}));

jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: jest.fn(() => ({
    retrieveSetupIntent: jest.fn(async () => ({
      setupIntent: { paymentMethodId: 'pm_test_default' },
      error: null,
    })),
  })),
  initPaymentSheet: jest.fn(async () => ({ error: null })),
  presentPaymentSheet: jest.fn(async () => ({ error: null })),
  PaymentSheetError: {},
}));

jest.mock('@/components/organisms/PersistentTabBar', () => ({
  PersistentTabBar: () => null,
}));

jest.mock('@/components/molecules/WalletWarningBanner', () => 'WalletWarningBanner');
jest.mock('@/components/organisms/BottomNavBar', () => 'BottomNavBar');
jest.mock('@/components/modals/SPInfoTooltip', () => ({ SPInfoTooltip: () => null }));
jest.mock('@/components/ui', () => ({
  Modal: () => null,
  LoadingSpinner: () => null,
}));

jest.mock('@/components/DisclaimerModal', () => {
  const ReactImpl = require('react');
  const { Pressable, Text } = require('react-native');

  return function MockDisclaimerModal({ visible, onAccept }: any) {
    if (!visible) return null;
    return ReactImpl.createElement(
      Pressable,
      {
        testID: 'mock-disclaimer-accept',
        onPress: () => onAccept('policy-test-id'),
      },
      ReactImpl.createElement(Text, null, 'Accept disclaimer')
    );
  };
});

const mockUseAuth = useAuth as jest.Mock;
const mockUseSPWallet = useSPWallet as jest.Mock;
const mockUseSubscriptionStatus = useSubscriptionStatus as jest.Mock;
const mockUseRoute = useRoute as jest.Mock;
const mockUseNavigation = useNavigation as jest.Mock;
const mockCreateTradeOffer = createTradeOfferWithHold as jest.Mock;
const mockGetItemById = getItemById as jest.Mock;
const mockGetAdminConfig = getAdminConfig as jest.Mock;
const mockGetTransactionFee = getTransactionFee as jest.Mock;
const mockGetPaymentMethod = getPaymentMethod as jest.Mock;
const mockCalculateCategorySP = calculateCategorySP as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();

describe('TradeOfferScreen', () => {
  const mockItem = {
    id: 'test-item-123',
    title: 'Test Item',
    price: 100,
    images: [{ url: 'https://example.com/image.jpg', thumbnail_url: null, display_order: 0 }],
    seller_id: 'seller-123',
    category_id: 'cat-1',
    accepts_swap_points: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRoute.mockReturnValue({
      params: { itemId: 'test-item-123' },
    });
    mockUseNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
      replace: mockReplace,
    });

    mockUseAuth.mockReturnValue({
      session: { user: { id: 'buyer-123', email: 'buyer@test.com' }, wallet_state: 'active' },
      refreshSession: jest.fn().mockResolvedValue(undefined),
    });
    mockUseSubscriptionStatus.mockReturnValue({
      status: 'active',
      canSpendSP: true,
      isTrialExpired: false,
    });
    mockUseSPWallet.mockReturnValue({
      available: 500,
      pending: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    });

    mockGetItemById.mockResolvedValue(mockItem);
    mockGetAdminConfig.mockResolvedValue({ sp_max_percentage_per_purchase: 50 });
    mockGetTransactionFee.mockResolvedValue(199);
    mockCalculateCategorySP.mockResolvedValue({
      max_spend_sp: 50,
      spend_percent: 50,
      earn_sp: 10,
    });
    mockCreateTradeOffer.mockResolvedValue({ success: true, trade_id: 'trade-123' });
    mockGetPaymentMethod.mockResolvedValue({ id: 'pm_test', payment_method_type: 'card', last_four: '4242' });
  });

  it('renders item details after loading', async () => {
    const { getByText, getAllByText } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(getByText('Test Item')).toBeTruthy();
      expect(getAllByText('$100.00').length).toBeGreaterThan(0);
    });
  });

  it('shows SP input for subscribers when listing accepts SP', async () => {
    const { getByTestId } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-amount-input')).toBeTruthy();
    });
  });

  it('hides SP input for free users', async () => {
    mockUseSubscriptionStatus.mockReturnValue({
      status: 'free',
      canSpendSP: false,
      isTrialExpired: true,
    });

    const { queryByTestId } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(queryByTestId('sp-amount-input')).toBeNull();
    });
  });

  it('caps SP input at max allowed value', async () => {
    const { getByTestId } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-amount-input')).toBeTruthy();
    });

    const spInput = getByTestId('sp-amount-input');
    fireEvent.changeText(spInput, '80');

    expect(getByTestId('sp-amount-input').props.value).toBe('50');
  });

  it('submits trade after disclaimer accept', async () => {
    const { getByTestId } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(getByTestId('send-offer-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('send-offer-button'));

    await waitFor(() => {
      expect(getByTestId('mock-disclaimer-accept')).toBeTruthy();
    });

    fireEvent.press(getByTestId('mock-disclaimer-accept'));

    await waitFor(() => {
      expect(mockCreateTradeOffer).toHaveBeenCalledWith({
        item_id: 'test-item-123',
        sp_amount: 0,
        payment_method_id: 'pm_test',
        cash_amount_cents: 10199,
        transaction_fee_cents: 199,
        buyer_subscription_status: 'active',
      });
      expect(mockReplace).toHaveBeenCalledWith('TradeSuccess', { tradeId: 'trade-123' });
    });
  });
});
