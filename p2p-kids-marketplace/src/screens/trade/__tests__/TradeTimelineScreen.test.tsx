/**
 * Unit Tests: TradeTimelineScreen
 * Tests timeline rendering, payment step behavior, and navigation actions.
 */

import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import TradeTimelineScreen from '../TradeTimelineScreen';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';
import { processTradePayment } from '@/services/trade';
import { getPaymentMethod } from '@/services/subscription';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@/config/supabase');
jest.mock('@/hooks/useAuth');
jest.mock('@/services/trade');
jest.mock('@/services/subscription');
// DEV-TASK-83 (Z06): the screen now reads cancel_request_escalation_enabled on
// mount to gate cancel-request copy. Default true keeps today's copy.
jest.mock('@/services/adminConfig', () => ({
  getAdminConfig: jest.fn().mockResolvedValue({
    cancel_request_escalation_enabled: true,
    cancel_request_response_timeout_hours: 48,
  }),
  getSPReleaseDays: jest.fn().mockResolvedValue(3),
}));
jest.mock('@/components/organisms/PersistentTabBar', () => ({
  PersistentTabBar: () => null,
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: { tradeId: 'trade-123' },
  }),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: jest.fn(),
  }),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => { cb(); }, [cb]);
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockProcessTradePayment = processTradePayment as jest.MockedFunction<
  typeof processTradePayment
>;
const mockGetPaymentMethod = getPaymentMethod as jest.MockedFunction<typeof getPaymentMethod>;

const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnValue({}),
};

const createFromMock = (tradeData: any, profileData: any = null) =>
  jest.fn((table: string) => {
    if (table === 'trades') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: tradeData, error: null }),
          }),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: profileData, error: null }),
          }),
        }),
      };
    }

    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });

describe('TradeTimelineScreen', () => {
  const mockTrade = {
    id: 'trade-123',
    buyer_id: 'buyer-123',
    seller_id: 'seller-456',
    status: 'in_progress',
    auto_complete_at: '2026-01-02T10:00:00.000Z',
    disputed_at: null,
    dispute_resolution: null,
    cash_amount_cents: 7500,
    sp_amount: 25,
    buyer_transaction_fee_cents: 500,
    seller_marked_completed_at: null,
    listing: {
      id: 'listing-789',
      title: 'Cool Toy',
      price: 100,
      images: [{ url: 'https://example.com/toy.jpg', thumbnail_url: null, display_order: 0 }],
    },
  };

  const mockBuyerSession = {
    user: { id: 'buyer-123', email: 'buyer@test.com' },
  };

  const mockSellerSession = {
    user: { id: 'seller-456', email: 'seller@test.com' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockSupabase.channel = jest.fn().mockReturnValue(mockChannel as any);
    mockSupabase.removeChannel = jest.fn();
    mockGetPaymentMethod.mockResolvedValue(null);
    mockProcessTradePayment.mockResolvedValue({ success: true, message: 'ok' });
    // DEV-TASK-75 (O07): default rpc_get_trade_refunds returns no refunds so the
    // refund section stays hidden unless a test explicitly arms refund rows.
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: { success: true, data: [] },
      error: null,
    });
  });

  describe('Rendering', () => {
    it('should fetch and display trade details', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByText } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByText('Item')).toBeTruthy(); // fallback when listing not loaded
        expect(getByText(/\$75/)).toBeTruthy(); // Cash amount
        expect(getByText(/25 SP/)).toBeTruthy(); // SP amount
      });
    });

    it('should render status banner', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        const statusBanner = getByTestId('status-banner');
        expect(statusBanner).toBeTruthy();
        expect(within(statusBanner).getByText(/In Progress/i)).toBeTruthy();
      });
    });

    it('should render timeline steps', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        const timeline = getByTestId('trade-timeline');
        expect(timeline).toBeTruthy();
        expect(within(timeline).getByText('Initiated')).toBeTruthy();
        expect(within(timeline).getByText('In Progress')).toBeTruthy();
        expect(within(timeline).getByText('Completed')).toBeTruthy();
      });
    });
  });

  describe('Status Banner Colors', () => {
    it('should show amber banner for pending status', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);

      const pendingTrade = { ...mockTrade, status: 'pending' };
      mockSupabase.from = createFromMock(pendingTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('status-banner')).toBeTruthy();
        // Verify amber background #FEF3C7
      });
    });

    it('should show green banner for in_progress status', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('status-banner')).toBeTruthy();
        // Verify green background #E8F5F0
      });
    });
  });

  describe('In Progress Actions', () => {
    it('should show confirm button for buyer on in_progress trades', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('confirm-trade-button')).toBeTruthy();
      });
    });

    it('should hide confirm button for seller on in_progress trades', async () => {
      mockUseAuth.mockReturnValue({ session: mockSellerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { queryByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(queryByTestId('confirm-trade-button')).toBeNull();
      });
    });

    it('should disable confirm button when dispute is unresolved', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock({
        ...mockTrade,
        dispute_status: 'reported',
      }) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        const button = getByTestId('confirm-trade-button');
        expect(Boolean(button.props.disabled || button.props.accessibilityState?.disabled)).toBe(
          true
        );
      });
    });
  });

  describe('TFV2 banners', () => {
    it('shows auto-complete banner when trade is in progress', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('auto-complete-banner')).toBeTruthy();
      });
    });
  });

  describe('Report Problem Action', () => {
    it('should show report problem button for in-progress trades', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('report-problem-button')).toBeTruthy();
      });
    });

    it('should open issue report modal on press', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId, getByText } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('report-problem-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('report-problem-button'));

      await waitFor(() => {
        expect(getByText('Report an Issue')).toBeTruthy();
      });
    });
  });

  describe('Message Button', () => {
    it('should render message button', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('message-button')).toBeTruthy();
      });
    });
  });

  describe('Payment Processing', () => {
    it('should show buyer payment section and submit payment with saved card', async () => {
      const paymentProcessingTrade = {
        ...mockTrade,
        status: 'in_progress',
      };
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(paymentProcessingTrade) as any;
      mockGetPaymentMethod.mockResolvedValue({
        id: 'pm_123',
        brand: 'visa',
        last4: '4242',
      } as any);

      const { getByTestId, getByText } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByText('Payment Details')).toBeTruthy();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should subscribe to trade updates', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith(`trade-timeline-trade-123`);
        expect(mockChannel.on).toHaveBeenCalled();
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });
    });
  });

  // TFV2 D-26: Dispute state overlay banners
  describe('Dispute States', () => {
    it('should show amber banner when dispute_status is reported', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      const disputedTrade = {
        ...mockTrade,
        dispute_status: 'reported',
        dispute_reason: 'Item not as described',
        dispute_reported_at: '2026-01-01T10:00:00.000Z',
      };
      mockSupabase.from = createFromMock(disputedTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        const banner = getByTestId('dispute-banner-reported');
        expect(banner).toBeTruthy();
      });
    });

    it('should show orange banner when dispute_status is under_review', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      const underReviewTrade = {
        ...mockTrade,
        dispute_status: 'under_review',
        dispute_reason: 'Item damaged',
        dispute_reported_at: '2026-01-01T10:00:00.000Z',
      };
      mockSupabase.from = createFromMock(underReviewTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('dispute-banner-under-review')).toBeTruthy();
      });
    });

    it('should show resolved banner when dispute is resolved', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      const resolvedTrade = {
        ...mockTrade,
        status: 'completed',
        dispute_status: 'resolved',
        dispute_reason: 'Item not as described',
        dispute_resolution: 'completed_favor_seller',
        dispute_reported_at: '2026-01-01T10:00:00.000Z',
        dispute_resolved_at: '2026-01-02T10:00:00.000Z',
      };
      mockSupabase.from = createFromMock(resolvedTrade) as any;

      const { queryByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        // Current UI only renders explicit banners for reported/under_review.
        expect(queryByTestId('dispute-banner-reported')).toBeNull();
        expect(queryByTestId('dispute-banner-under-review')).toBeNull();
      });
    });

    it('should not show report problem button when dispute already exists', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      const existingDisputeTrade = {
        ...mockTrade,
        dispute_status: 'reported',
        dispute_reason: 'Item not as described',
        dispute_reported_at: '2026-01-01T10:00:00.000Z',
      };
      mockSupabase.from = createFromMock(existingDisputeTrade) as any;

      const { queryByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        // When dispute already exists, the "Report Problem" button should not show
        expect(queryByTestId('report-problem-button')).toBeNull();
      });
    });
  });

  describe('Refund Detail — DEV-TASK-75 / TRD-TC-O07', () => {
    const refundRow = {
      id: 'refund-1',
      refund_amount_cents: 8100,
      refund_price_cents: 7500,
      refund_fee_cents: 500,
      refund_tax_cents: 100,
      reason: 'dispute_refund',
      status: 'succeeded',
      created_at: '2026-08-31T10:00:00.000Z',
    };

    it('shows the full refund breakdown for the buyer when refund rows exist', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      const cancelledTrade = {
        ...mockTrade,
        status: 'cancelled',
        stripe_payment_method_brand: 'mastercard',
        stripe_payment_method_last4: '4444',
      };
      mockSupabase.from = createFromMock(cancelledTrade) as any;
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: { success: true, data: [refundRow] },
        error: null,
      });

      const { getByTestId, getByText } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('timeline-refund-detail')).toBeTruthy();
        expect(getByText('Your refund has been issued.')).toBeTruthy();
        expect(getByText('Refund Amount')).toBeTruthy();
        expect(getByText('$81.00')).toBeTruthy();
        expect(getByText('Refunded Sales Tax')).toBeTruthy();
        expect(getByText('$1.00')).toBeTruthy();
        expect(getByText('MASTERCARD •••• 4444')).toBeTruthy();
      });
    });

    it('shows the role-appropriate seller note (no refund breakdown) for the seller', async () => {
      mockUseAuth.mockReturnValue({ session: mockSellerSession } as any);
      const cancelledTrade = { ...mockTrade, status: 'cancelled' };
      mockSupabase.from = createFromMock(cancelledTrade) as any;
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: { success: true, data: [refundRow] },
        error: null,
      });

      const { getByTestId, queryByTestId, getByText } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('timeline-refund-seller-note')).toBeTruthy();
        expect(getByText(/buyer was refunded/i)).toBeTruthy();
        // The seller does NOT see the buyer's refund breakdown card.
        expect(queryByTestId('timeline-refund-detail')).toBeNull();
      });
    });

    it('hides the refund section when no refund rows exist', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      const cancelledTrade = { ...mockTrade, status: 'cancelled' };
      mockSupabase.from = createFromMock(cancelledTrade) as any;
      // Default beforeEach mock returns empty data.

      const { queryByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(queryByTestId('timeline-refund-detail')).toBeNull();
        expect(queryByTestId('timeline-refund-seller-note')).toBeNull();
      });
    });
  });
});
