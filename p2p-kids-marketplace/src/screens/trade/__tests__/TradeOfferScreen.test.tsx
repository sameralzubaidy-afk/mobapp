import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeOfferScreen from '../TradeOfferScreen';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth, useSPWallet, useSubscriptionStatus } from '@/hooks/useAuth';
import { createTradeOfferWithHold } from '@/services/trade';
import { getItemById } from '@/services/items';
import { getAdminConfig, getBuyerFeeForCheckout } from '@/services/adminConfig';
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
  // DEV-TASK-81: TradeOfferScreen now uses useFocusEffect to refresh the saved
  // payment method on refocus. Run the focus callback ONCE (wrapped in a
  // React.useEffect keyed on the stable callback) to mimic react-navigation's
  // effect lifecycle without re-invoking it on every render.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
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

// DEV-TASK-81: mock the Payment Sheet + attach edge function so the add-new-card
// flow can be driven in tests. mockPresentSheet resolves the newly-added card.
jest.mock('@/hooks/usePaymentSheet', () => ({
  usePaymentSheet: jest.fn(() => ({
    setupPaymentSheet: jest.fn().mockResolvedValue(undefined),
    presentSheet: mockPresentSheet,
    loading: false,
    error: null,
    resetError: jest.fn(),
  })),
}));

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'buyer-123' }, access_token: 'test-token' } },
        error: null,
      }),
    },
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

const mockPresentSheet = jest.fn().mockResolvedValue({ success: true, paymentMethodId: 'pm_new' });

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
const mockGetBuyerFeeForCheckout = getBuyerFeeForCheckout as jest.Mock;
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
    // R1 — Tiered Buyer-Fee Engine: resolve the buyer fee (active member -> flat 149).
    mockGetBuyerFeeForCheckout.mockResolvedValue({
      feeCents: 149,
      feeState: 'active_member',
      label: 'Safety & Platform Fee',
    });
    mockGetTransactionFee.mockResolvedValue(199);
    mockCalculateCategorySP.mockResolvedValue({
      max_spend_sp: 50,
      spend_percent: 50,
      earn_sp: 10,
    });
    mockCreateTradeOffer.mockResolvedValue({ success: true, trade_id: 'trade-123' });
    mockGetPaymentMethod.mockResolvedValue({
      id: 'pm_test',
      payment_method_type: 'card',
      last_four: '4242',
    });
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

  it('hides SP input and explains when wallet is frozen (DEV-TASK-112 items 2+8)', async () => {
    // Active subscription BUT frozen wallet. canSpendSP stays true here because
    // session.can_spend_sp is subscription-only after refreshSession() — the gate
    // must key on wallet_state, so this case proves the wallet gate wins.
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'buyer-123', email: 'buyer@test.com' }, wallet_state: 'frozen' },
      refreshSession: jest.fn().mockResolvedValue(undefined),
    });
    mockUseSubscriptionStatus.mockReturnValue({
      status: 'active',
      canSpendSP: true,
      isTrialExpired: false,
    });

    const { queryByTestId, getByText } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(queryByTestId('sp-amount-input')).toBeNull();
      expect(
        getByText(
          'Your Swap Points wallet is frozen. Renew your subscription to restore SP spending.'
        )
      ).toBeTruthy();
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
    const { getByTestId, getByText } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(getByTestId('send-offer-button')).toBeTruthy();
    });

    // R1 — wait for the server-resolved tiered fee to render before submitting, so
    // the client sends the correct 149¢ flat fee (avoids the async race where
    // buyerFeeInfo is still null and handleInitiateTrade falls back to 99/299).
    await waitFor(() => {
      expect(getByText('$1.49')).toBeTruthy();
    });

    // Deterministic submit: wait for the saved payment method to load so
    // handleInitiateTrade doesn't early-return on a not-yet-loaded card (BP-60-style
    // timing flake that only shows when the full file runs back-to-back).
    await waitFor(() => {
      expect(getByText('Use Saved Card')).toBeTruthy();
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
        // R1 — Tiered Buyer-Fee Engine: active member pays the flat Safety &
        // Platform Fee (149¢) resolved via getBuyerFeeForCheckout.
        cash_amount_cents: 10149, // $100 item + $1.49 flat fee
        transaction_fee_cents: 149,
        tax_amount_cents: 0, // MODULE-15.3-PART3 TAX-011: contract now includes tax_amount_cents
        buyer_subscription_status: 'active',
      });
      expect(mockReplace).toHaveBeenCalledWith('TradeSuccess', {
        tradeId: 'trade-123',
        role: 'buyer',
        spUsed: 0,
        spAmountDollars: 0,
        remainingSP: 500,
        listingType: 'accept_sp',
      });
    });
  });

  // DT-21 Item 1: the success screen must show the projected post-reserve SP balance
  // (available − this offer's SP), not the stale pre-reserve figure the session still
  // holds before the wallet Realtime refresh lands.
  it('passes the projected post-reserve SP balance to TradeSuccess', async () => {
    const { getByTestId, getByText } = render(<TradeOfferScreen />);

    await waitFor(() => {
      expect(getByTestId('sp-amount-input')).toBeTruthy();
    });

    // Buyer applies 8 SP of their 500 available.
    fireEvent.changeText(getByTestId('sp-amount-input'), '8');

    // Deterministic submit: wait for the saved payment method to load before
    // pressing send (see the same note on the 'submits trade' test).
    await waitFor(() => {
      expect(getByText('Use Saved Card')).toBeTruthy();
    });

    fireEvent.press(getByTestId('send-offer-button'));

    await waitFor(() => {
      expect(getByTestId('mock-disclaimer-accept')).toBeTruthy();
    });

    fireEvent.press(getByTestId('mock-disclaimer-accept'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('TradeSuccess', {
        tradeId: 'trade-123',
        role: 'buyer',
        spUsed: 8,
        spAmountDollars: 8,
        remainingSP: 492, // 500 available − 8 SP reserved by this offer
        listingType: 'accept_sp',
      });
    });
  });

  // DEV-TASK-81: after adding a new card from checkout, the displayed/used payment
  // method must be the newly-added card, NOT the stale old one. Regression: the
  // post-add read called getPaymentMethod() WITHOUT forceRefresh=true, so the
  // in-memory cache returned the old card. The post-add read MUST pass forceRefresh.
  it('shows the newly-added card after the add-new-card flow (DEV-TASK-81)', async () => {
    // No saved card on mount; the server returns the new card on the post-add read.
    const forceRefreshArgs: (boolean | undefined)[] = [];
    mockGetPaymentMethod.mockImplementation((forceRefresh?: boolean) => {
      forceRefreshArgs.push(forceRefresh);
      if (forceRefresh === true) {
        return Promise.resolve({
          id: 'pm_new',
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2030,
        });
      }
      return Promise.resolve(null); // mount read: no saved card yet
    });

    const { getByTestId, findByText } = render(<TradeOfferScreen />);

    // No saved card on mount -> "Add New Card" button is shown.
    await waitFor(() => {
      expect(getByTestId('add-new-card-button')).toBeTruthy();
    });

    // Stripe sheet returns the new card; attach EF persists it; screen refreshes.
    fireEvent.press(getByTestId('add-new-card-button'));

    // The post-add read MUST pass forceRefresh=true (bypass the stale cache).
    await waitFor(() => {
      expect(forceRefreshArgs).toContain(true);
    });

    // …and the newly-added card becomes the displayed/active one.
    expect(await findByText(/Paying with VISA/)).toBeTruthy();
  });
});
