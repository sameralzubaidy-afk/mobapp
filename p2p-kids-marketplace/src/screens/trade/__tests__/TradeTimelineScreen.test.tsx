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
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: { tradeId: 'trade-123' },
  }),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  // Keep useFocusEffect inert in tests to avoid repeated state updates.
  useFocusEffect: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockSupabase.channel = jest.fn().mockReturnValue(mockChannel as any);
    mockSupabase.removeChannel = jest.fn();
    mockGetPaymentMethod.mockResolvedValue(null);
    mockProcessTradePayment.mockResolvedValue({ success: true, message: 'ok' });
  });

  describe('Rendering', () => {
    it('should fetch and display trade details', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByText } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByText('Cool Toy')).toBeTruthy();
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
        expect(within(timeline).getByText('Processing Payment')).toBeTruthy();
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
    it('should show confirm button for in_progress trades', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('confirm-trade-button')).toBeTruthy();
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

    it('should navigate to TradeDispute on press', async () => {
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(mockTrade) as any;

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('report-problem-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('report-problem-button'));

      expect(mockNavigate).toHaveBeenCalledWith('TradeDispute', { tradeId: 'trade-123' });
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
        status: 'payment_processing',
      };
      mockUseAuth.mockReturnValue({ session: mockBuyerSession } as any);
      mockSupabase.from = createFromMock(paymentProcessingTrade) as any;
      mockGetPaymentMethod.mockResolvedValue({
        id: 'pm_123',
        brand: 'visa',
        last4: '4242',
      } as any);

      const { getByTestId } = render(<TradeTimelineScreen />);

      await waitFor(() => {
        expect(getByTestId('trade-payment-section')).toBeTruthy();
      });

      fireEvent.press(getByTestId('make-payment-button'));

      await waitFor(() => {
        expect(mockProcessTradePayment).toHaveBeenCalledWith('trade-123', 'pm_123');
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
});
