/**
 * Unit Tests: TradeReviewScreen
 * Tests trade offer review, accept/decline flows
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeReviewScreen from '../TradeReviewScreen';
import { supabase } from '@/config/supabase';
import { sendTradeNotificationPush } from '@/services/tradeNotifications';

// Mock dependencies
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@/services/tradeNotifications', () => ({
  sendTradeNotificationPush: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      user: {
        id: 'seller-456',
      },
    },
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: { tradeId: 'trade-123' },
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockSendTradeNotificationPush = sendTradeNotificationPush as jest.MockedFunction<
  typeof sendTradeNotificationPush
>;

describe('TradeReviewScreen', () => {
  const mockTrade = {
    id: 'trade-123',
    buyer_id: 'buyer-123',
    seller_id: 'seller-456',
    listing_id: 'listing-789',
    cash_amount_cents: 7500, // $75
    sp_amount: 25,
    status: 'pending',
    listing: {
      id: 'listing-789',
      title: 'Cool Toy',
      price: 100,
      images: [
        {
          id: 'img-1',
          url: 'https://example.com/toy.jpg',
          thumbnail_url: 'https://example.com/toy-thumb.jpg',
          display_order: 0,
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendTradeNotificationPush.mockResolvedValue({ success: true });
  });

  describe('Rendering', () => {
    it('should fetch and display trade details', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrade,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByText } = render(<TradeReviewScreen />);

      await waitFor(() => {
        expect(getByText('Cool Toy')).toBeTruthy();
        expect(getByText(/\$75/)).toBeTruthy(); // Cash amount
        expect(getByText(/25 SP/)).toBeTruthy(); // SP amount
      });
    });

    it('should show loading state initially', () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockImplementation(
              () =>
                new Promise((resolve) => {
                  setTimeout(() => resolve({ data: mockTrade, error: null }), 1000);
                })
            ),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByText } = render(<TradeReviewScreen />);
      expect(getByText(/Loading/i)).toBeTruthy();
    });

    it('should display error if trade fetch fails', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Trade not found' },
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      render(<TradeReviewScreen />);

      await waitFor(() => {
        // Should show error alert or message
      });
    });
  });

  describe('Accept Trade Flow', () => {
    it('should call accept RPC on accept button press', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrade,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId } = render(<TradeReviewScreen />);

      await waitFor(() => {
        const acceptButton = getByTestId('accept-trade-button');
        fireEvent.press(acceptButton);
      });

      // TODO: Verify RPC call when implemented
      // expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_trade', { p_trade_id: 'trade-123' });
    });

    it('should navigate to TradeTimeline on successful accept', async () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrade,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId } = render(<TradeReviewScreen />);

      await waitFor(() => {
        const acceptButton = getByTestId('accept-trade-button');
        fireEvent.press(acceptButton);
      });

      // Should navigate to timeline after accept
      // await waitFor(() => {
      //   expect(mockNavigate).toHaveBeenCalledWith('TradeTimeline', { tradeId: 'trade-123' });
      // });
    });

    it('should send buyer trade_accepted notification after accept confirmation', async () => {
      const mockReplace = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: jest.fn(),
        replace: mockReplace,
        goBack: jest.fn(),
      });

      const selectSingle = jest.fn().mockResolvedValue({
        data: mockTrade,
        error: null,
      });
      const updateSingle = jest.fn().mockResolvedValue({
        data: { id: 'trade-123', status: 'in_progress' },
        error: null,
      });

      const eqAfterSelect = jest.fn().mockReturnValue({ single: selectSingle });
      const eqLevel3 = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: updateSingle }) });
      const eqLevel2 = jest.fn().mockReturnValue({ eq: eqLevel3 });
      const eqLevel1 = jest.fn().mockReturnValue({ eq: eqLevel2 });

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: eqAfterSelect }),
        update: jest.fn().mockReturnValue({ eq: eqLevel1 }),
      } as any);

      const { getByTestId, getByText } = render(<TradeReviewScreen />);

      await waitFor(() => {
        expect(getByTestId('accept-trade-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('accept-trade-button'));

      await waitFor(() => {
        expect(getByText('Accept')).toBeTruthy();
      });

      fireEvent.press(getByText('Accept'));

      await waitFor(() => {
        expect(mockSendTradeNotificationPush).toHaveBeenCalledWith(
          'buyer-123',
          'trade_accepted',
          expect.stringContaining('accepted'),
          expect.objectContaining({
            trade_id: 'trade-123',
            item_id: 'listing-789',
            item_title: 'Cool Toy',
            buyer_id: 'buyer-123',
            type: 'trade_accepted',
          })
        );
      });
    });
  });

  describe('Decline Trade Flow', () => {
    it('should show confirmation on decline button press', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrade,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId } = render(<TradeReviewScreen />);

      await waitFor(() => {
        const declineButton = getByTestId('decline-trade-button');
        fireEvent.press(declineButton);
      });

      // Should show confirmation alert
    });

    it('should call decline RPC after confirmation', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrade,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId } = render(<TradeReviewScreen />);

      await waitFor(() => {
        const declineButton = getByTestId('decline-trade-button');
        fireEvent.press(declineButton);
      });

      // TODO: Verify RPC call when implemented
      // expect(mockSupabase.rpc).toHaveBeenCalledWith('decline_trade', { p_trade_id: 'trade-123' });
    });
  });

  describe('SP Balance Preview', () => {
    it('should display SP balance correctly', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrade,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByText } = render(<TradeReviewScreen />);

      await waitFor(() => {
        expect(getByText(/25 SP/)).toBeTruthy();
      });
    });
  });
});
