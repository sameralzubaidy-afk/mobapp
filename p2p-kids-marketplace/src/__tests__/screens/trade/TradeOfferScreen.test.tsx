/**
 * File: p2p-kids-marketplace/src/__tests__/screens/trade/TradeOfferScreen.test.tsx
 * MODULE-15.1.2 Addendum B – Unit/Render tests: value stack in TradeOfferScreen
 * Run: npm run test:unit
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import TradeOfferScreen from '../../../screens/trade/TradeOfferScreen';
import { useSubscriptionStatus, useSPWallet } from '@/hooks/useAuth';
import { getTransactionFee } from '@/services/subscription';

// ─── Mock all external dependencies ─────────────────────────────────────────

jest.mock('@/services/items', () => ({
  getItemById: jest.fn().mockResolvedValue({
    id: 'item-001',
    title: 'Blue Toy Car',
    price: 20.0,
    images: [{ url: 'https://example.com/img.png' }],
    accepts_swap_points: true,
    category_id: 'cat-001',
    status: 'available',
  }),
}));

jest.mock('@/services/trade', () => ({
  initiateTradeV2: jest.fn(),
}));

jest.mock('@/services/adminConfig', () => ({
  getAdminConfig: jest.fn().mockResolvedValue({ sp_max_percentage_per_purchase: 50 }),
  // R1 — Tiered Buyer-Fee Engine: active member / first-trade flat fee (149¢).
  getBuyerFeeForCheckout: jest.fn().mockResolvedValue({
    feeCents: 149,
    feeState: 'active_member',
    label: 'Safety & Platform Fee',
  }),
}));

jest.mock('@/services/categoryService', () => ({
  calculateCategorySP: jest.fn().mockResolvedValue(null), // fall back to adminConfig %
}));

const _mockSubStatus = { status: 'active' };
const _mockWallet = { available: 100, pending: 0, reserved: 0 };

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn().mockReturnValue({
    session: { user: { id: 'user-001' }, wallet_state: 'active' },
    refreshSession: jest.fn(),
  }),
  useSPWallet: jest.fn().mockReturnValue({ available: 100, pending: 0, reserved: 0 }),
  useSubscriptionStatus: jest.fn().mockReturnValue({ status: 'active' }),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn().mockReturnValue({ params: { itemId: 'item-001' } }),
  useNavigation: jest.fn().mockReturnValue({ goBack: jest.fn(), replace: jest.fn() }),
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

jest.mock('@/services/subscription', () => ({
  getTransactionFee: jest.fn().mockResolvedValue(99),
  getPaymentMethod: jest
    .fn()
    .mockResolvedValue({ id: 'pm_test', payment_method_type: 'card', last_four: '4242' }),
}));

const mockGetTransactionFee = getTransactionFee as jest.Mock;

jest.mock('@/components/molecules/WalletWarningBanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/DisclaimerModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/modals/SPInfoTooltip', () => ({ SPInfoTooltip: () => null }));

jest.mock('@/components/ui', () => ({
  Modal: ({ children }: any) => children,
  LoadingSpinner: () => null,
}));

jest.mock('@/components/ScreenLayout', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

jest.mock('@/components/organisms/PersistentTabBar', () => ({
  PersistentTabBar: () => null,
}));

// Phosphor icons
jest.mock('phosphor-react-native', () => ({
  ArrowsLeftRight: () => null,
  CaretLeft: () => null,
  Coins: () => null,
  ShieldCheck: () => null,
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TradeOfferScreen – Addendum B: Value Stack', () => {
  afterEach(() => jest.clearAllMocks());

  describe('Subscriber view ($1.49 flat Safety & Platform Fee)', () => {
    beforeEach(() => {
      (useSubscriptionStatus as jest.Mock).mockReturnValue({ status: 'active' });
      (useSPWallet as jest.Mock).mockReturnValue({ available: 100, pending: 0, reserved: 0 });
      mockGetTransactionFee.mockResolvedValue(99);
    });

    it('renders the value-stack-row testID', async () => {
      const { findByTestId } = render(<TradeOfferScreen />);
      const row = await findByTestId('value-stack-row');
      expect(row).toBeTruthy();
    });

    it('shows "What you pay" title in value stack', async () => {
      const { findByText } = render(<TradeOfferScreen />);
      const title = await findByText('What you pay');
      expect(title).toBeTruthy();
    });

    it('shows $1.49 flat fee for subscriber (R1 active member)', async () => {
      const { findByText } = render(<TradeOfferScreen />);
      const feeText = await findByText('$1.49');
      expect(feeText).toBeTruthy();
    });

    it('shows "Safety & Platform Fee" label', async () => {
      const { findByText } = render(<TradeOfferScreen />);
      const label = await findByText('Safety & Platform Fee');
      expect(label).toBeTruthy();
    });

    it('shows "Offer amount" label', async () => {
      const { findByText } = render(<TradeOfferScreen />);
      expect(await findByText('Offer amount')).toBeTruthy();
    });

    it('shows "Total cash" label', async () => {
      const { findByText } = render(<TradeOfferScreen />);
      expect(await findByText('Total cash')).toBeTruthy();
    });
  });

  describe('Non-subscriber view ($1.49 flat first-trade fee)', () => {
    beforeEach(() => {
      (useSubscriptionStatus as jest.Mock).mockReturnValue({ status: 'inactive' });
      (useSPWallet as jest.Mock).mockReturnValue({ available: 0, pending: 0, reserved: 0 });
      mockGetTransactionFee.mockResolvedValue(299);
    });

    it('shows $1.49 flat first-trade fee for non-subscriber', async () => {
      const { findByText } = render(<TradeOfferScreen />);
      const feeText = await findByText('$1.49');
      expect(feeText).toBeTruthy();
    });

    it('does NOT show the legacy $2.99 fee for non-subscriber', async () => {
      const { findByText, queryByText } = render(<TradeOfferScreen />);
      // Wait for load
      await findByText('What you pay');
      expect(queryByText('$2.99')).toBeNull();
    });
  });

  describe('Trade/trial user view ($1.49 flat fee)', () => {
    beforeEach(() => {
      mockGetTransactionFee.mockResolvedValue(99);
    });

    it('shows $1.49 for trial subscriber (R1 active member)', async () => {
      (useSubscriptionStatus as jest.Mock).mockReturnValue({ status: 'trial' });
      const { findByText } = render(<TradeOfferScreen />);
      expect(await findByText('$1.49')).toBeTruthy();
    });

    it('shows $1.49 for grace-period user (R1 first-trade flat fee)', async () => {
      (useSubscriptionStatus as jest.Mock).mockReturnValue({ status: 'grace' });
      const { findByText } = render(<TradeOfferScreen />);
      expect(await findByText('$1.49')).toBeTruthy();
    });
  });
});
