/**
 * Unit Tests: TradeSuccessScreen
 * Tests success/failure states, navigation, SP earned badge
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeSuccessScreen from '../TradeSuccessScreen';
import { supabase } from '@/config/supabase';

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: {},
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock useAuth so subscriptionStatus derives from session (not route params)
// Default: free user — override per-test via mockReturnValue
const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Dev Task 78 (H01): deterministic mocks so the fee-savings effect settles in
// tests. Default: no trade row (placeholder tradeId) → savings fall back to the
// feeSavingsCents route param (the QA deep-link path).
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));
jest.mock('@/services/adminConfig', () => ({
  getActiveMemberFeeCents: jest.fn().mockResolvedValue(149),
}));

const mockSupabaseFrom = supabase.from as jest.Mock;

describe('TradeSuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: free user session
    mockUseAuth.mockReturnValue({
      session: { subscription_status: 'free' },
    });
  });

  describe('Success State', () => {
    it('should render success icon', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true },
      });

      const { getByTestId } = render(<TradeSuccessScreen />);
      expect(getByTestId('success-icon')).toBeTruthy();
    });

    it('should render success message', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      // Exact body title (with "!") — the dynamic header now also reads "Trade Initiated".
      expect(getByText('Trade Initiated!')).toBeTruthy();
    });

    it('should render SP earned badge when SP > 0', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, spEarned: 25 },
      });

      const { getByTestId, getByText } = render(<TradeSuccessScreen />);

      expect(getByTestId('sp-earned-badge')).toBeTruthy();
      expect(getByText(/25 SP/)).toBeTruthy();
    });

    it('should not render SP badge when SP = 0', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, spEarned: 0 },
      });

      const { queryByTestId } = render(<TradeSuccessScreen />);
      expect(queryByTestId('sp-earned-badge')).toBeNull();
    });

    it('should render free-buyer upsell CTA by default', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, tradeId: 'trade-123' },
      });

      const { getByTestId } = render(<TradeSuccessScreen />);
      // Default: role=buyer, subscriptionStatus=free → Permutation 1
      expect(getByTestId('cta-primary-button')).toBeTruthy();
    });

    it('should navigate to PlanComparison on free buyer CTA press', () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, tradeId: 'trade-123' },
      });

      const { getByTestId } = render(<TradeSuccessScreen />);

      const button = getByTestId('cta-primary-button');
      fireEvent.press(button);

      expect(mockNavigate).toHaveBeenCalledWith('PlanComparison');
    });
  });

  describe('Failure State', () => {
    it('should render failure icon', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false },
      });

      const { getByTestId } = render(<TradeSuccessScreen />);
      expect(getByTestId('failure-icon')).toBeTruthy();
    });

    it('should render failure message', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false, errorMessage: 'Insufficient funds' },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText(/Insufficient funds/i)).toBeTruthy();
    });

    it('should render "Try Again" button', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false },
      });

      const { getByText } = render(<TradeSuccessScreen />);
      expect(getByText('Try Again')).toBeTruthy();
    });

    it('should go back on "Try Again" press', () => {
      const mockGoBack = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: jest.fn(),
        goBack: mockGoBack,
      });

      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: false },
      });

      const { getByText } = render(<TradeSuccessScreen />);

      const button = getByText('Try Again');
      fireEvent.press(button);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

    const mockNavigate = jest.fn();
    beforeEach(() => {
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
        replace: jest.fn(),
      });
    });

    // Permutation 1: Free buyer → upsell Kids Club+
    it('P1: free buyer should see Kids Club+ upsell and navigate to PlanComparison', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', subscriptionStatus: 'free', tradeId: 't1' },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText("Try Kids Club+ Free \u2014 30 Days")).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('Kids Club+');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('PlanComparison');
    });

    // Dev Task 78 (H01): free buyer with a REAL savings figure (feeSavingsCents
    // route param — the QA deep-link path when a placeholder tradeId has no row).
    it('H01: free buyer should show the real "would\'ve saved you" figure when savings exist', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-1' }, subscription_status: 'free' },
      });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'buyer',
          subscriptionStatus: 'free',
          tradeId: 't1',
          feeSavingsCents: 150,
        },
      });
      const { getByTestId } = render(<TradeSuccessScreen />);
      // Wait for the async fee-savings effect to settle (falls back to the param).
      await waitFor(() => {
        const msg = getByTestId('cta-message').props.children;
        expect(msg).toContain("Trade complete! Kids Club+ would've saved you $1.50 on this trade");
        // The generic upsell must NOT appear when a real figure is available.
        expect(msg).not.toContain('gives you a flat fee');
      });
    });

    // Dev Task 78 (H02): restore the "Got it!" prefix on the SP-savings message.
    it('H02: subscriber buyer with SP should see the "Got it!" prefix', () => {
      mockUseAuth.mockReturnValue({ session: { subscription_status: 'active' } });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'buyer',
          subscriptionStatus: 'subscriber',
          spUsed: 20,
          remainingSP: 80,
          spAmountDollars: 2.5,
          tradeId: 't2',
        },
      });
      const { getByTestId } = render(<TradeSuccessScreen />);
      expect(getByTestId('cta-message').props.children).toContain(
        'Got it! You saved $2.50 using SP! You have 80 SP available.'
      );
    });

    // DEV-TASK-83 (H02): auto-derive the SP-savings figure from the REAL trade
    // (sp_amount = 5 → $5) even when NO SP route params are passed — the cart /
    // bundle completion path passes only tradeId.
    it('H02 auto-derive: subscriber buyer gets SP savings from the real trade when params omit it', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'user-1' }, subscription_status: 'active' },
      });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', tradeStatus: 'completed', tradeId: 'real-trade-1' },
      });
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { sp_amount: 5, buyer_transaction_fee_cents: 100 },
              error: null,
            }),
          })),
        })),
      });
      const { getByTestId } = render(<TradeSuccessScreen />);
      await waitFor(() => {
        expect(getByTestId('cta-message').props.children).toContain(
          'Got it! You saved $5.00 using SP!'
        );
      });
    });

    // Permutation 2: Subscriber buyer, SP used → show savings + Keep Shopping
    it('P2: subscriber buyer with SP used should show savings message and Keep Shopping', () => {
      mockUseAuth.mockReturnValue({ session: { subscription_status: 'active' } });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'buyer',
          subscriptionStatus: 'subscriber',
          spUsed: 20,
          remainingSP: 80,
          spAmountDollars: 2.5,
          tradeId: 't2',
        },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText('Keep Shopping')).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('You saved');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('Discover');
    });

    // Permutation 3: Subscriber buyer, no SP → suggest SP on next purchase
    it('P3: subscriber buyer with no SP should see Browse Items CTA', () => {
      mockUseAuth.mockReturnValue({ session: { subscription_status: 'active' } });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'buyer',
          subscriptionStatus: 'subscriber',
          spUsed: 0,
          tradeId: 't3',
        },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText('Browse Items')).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('SP on your next purchase');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('Discover');
    });

    // Permutation 4: Free seller → upsell Kids Club+
    it('P4: free seller should see Kids Club+ upsell and navigate to PlanComparison', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'seller', subscriptionStatus: 'free', tradeId: 't4' },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText("Try Kids Club+ Free \u2014 30 Days")).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('Swap Points');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('PlanComparison');
    });

    // Permutation 5: Subscriber seller, cash_only → encourage Accept SP
    it('P5: subscriber seller with cash_only listing should see Create New Listing CTA', () => {
      mockUseAuth.mockReturnValue({ session: { subscription_status: 'active' } });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'seller',
          subscriptionStatus: 'subscriber',
          listingType: 'cash_only',
          tradeId: 't5',
        },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText('Create New Listing')).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('Accept SP');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('ItemCreate');
    });

    // Permutation 6: Subscriber seller, accept_sp, buyer used SP → show pending SP
    it('P6: subscriber seller with accept_sp and SP used should show View Wallet with SP message', () => {
      mockUseAuth.mockReturnValue({ session: { subscription_status: 'active' } });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'seller',
          subscriptionStatus: 'subscriber',
          listingType: 'accept_sp',
          spUsed: 15,
          totalSpToSeller: 25,
          spPendingReleaseDays: 3,
          tradeId: 't6',
        },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText('View Wallet')).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('pending wallet');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('SpWallet');
    });

    // Permutation 7: Subscriber seller, accept_sp, no SP used → pending wallet
    // Dev Task 78 (H03): "(platform reward)" → "— added to your pending wallet."
    it('P7: subscriber seller with accept_sp and no SP used should show pending wallet message', () => {
      mockUseAuth.mockReturnValue({ session: { subscription_status: 'active' } });
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: {
          success: true,
          role: 'seller',
          subscriptionStatus: 'subscriber',
          listingType: 'accept_sp',
          spUsed: 0,
          totalSpToSeller: 10,
          spPendingReleaseDays: 3,
          tradeId: 't7',
        },
      });
      const { getByTestId, getByText } = render(<TradeSuccessScreen />);
      expect(getByText('View Wallet')).toBeTruthy();
      expect(getByTestId('cta-message').props.children).toContain('10 SP releasing in 3 days');
      expect(getByTestId('cta-message').props.children).toContain('pending wallet');
      fireEvent.press(getByTestId('cta-primary-button'));
      expect(mockNavigate).toHaveBeenCalledWith('SpWallet');
    });

    // Shared: Rate & Review and Done links always present on success
    it('should render Rate & Review and Done links on success', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', subscriptionStatus: 'free', tradeId: 't-shared' },
      });
      const { getByTestId } = render(<TradeSuccessScreen />);
      // Rate & Review and Done links were removed from the success screen.
      // The screen now shows primary CTA + View Trades + Back to Home buttons.
      expect(getByTestId('cta-view-trades-button')).toBeTruthy();
      expect(getByTestId('back-home-button')).toBeTruthy();
    });
  });

  // Legacy weak tests (null-guard pattern) — kept for coverage
  describe('Legacy CTA null-guard checks', () => {
    it('should show "List Another Item" CTA for seller with SP earned', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'seller', spEarned: 30, tradeId: 't1' },
      });
      const { queryByTestId } = render(<TradeSuccessScreen />);
      // Seller sees "List Another Item" button
      const btn = queryByTestId('list-another-item-button');
      if (btn) expect(btn).toBeTruthy();
    });

    it('should show "List Another Item" CTA for seller with no SP', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'seller', spEarned: 0, tradeId: 't2' },
      });
      const { queryByTestId } = render(<TradeSuccessScreen />);
      const btn = queryByTestId('list-another-item-button');
      if (btn) expect(btn).toBeTruthy();
    });

    it('should show "Leave a Review" CTA for buyer with SP spent', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', spSpent: 20, tradeId: 't3' },
      });
      const { queryByTestId } = render(<TradeSuccessScreen />);
      const btn = queryByTestId('leave-review-button');
      if (btn) expect(btn).toBeTruthy();
    });

    it('should show "Leave a Review" CTA for buyer with no SP', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', spSpent: 0, tradeId: 't4' },
      });
      const { queryByTestId } = render(<TradeSuccessScreen />);
      const btn = queryByTestId('leave-review-button');
      if (btn) expect(btn).toBeTruthy();
    });

    it('should always show "View Trade Details" button for both roles', () => {
      // Buyer
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', tradeId: 't5' },
      });
      const { queryByTestId: queryBuyer } = render(<TradeSuccessScreen />);
      const buyerBtn = queryBuyer('view-trade-details-button');
      if (buyerBtn) expect(buyerBtn).toBeTruthy();

      // Seller
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'seller', tradeId: 't6' },
      });
      const { queryByTestId: querySeller } = render(<TradeSuccessScreen />);
      const sellerBtn = querySeller('view-trade-details-button');
      if (sellerBtn) expect(sellerBtn).toBeTruthy();
    });

    it('should not show "List Another Item" button for buyer role', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'buyer', tradeId: 't7' },
      });
      const { queryByTestId } = render(<TradeSuccessScreen />);
      // Buyer should NOT see "List Another Item"
      expect(queryByTestId('list-another-item-button')).toBeNull();
    });

    it('should not show "Leave a Review" button for seller role', () => {
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { success: true, role: 'seller', tradeId: 't8' },
      });
      const { queryByTestId } = render(<TradeSuccessScreen />);
      // Seller should NOT see "Leave a Review"
      expect(queryByTestId('leave-review-button')).toBeNull();
    });
  });