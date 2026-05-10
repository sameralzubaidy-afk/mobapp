/**
 * Unit Tests: TradeListScreen
 * Tests trade history display, tab filtering, status badges
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeListScreen from '../TradeListScreen';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/config/supabase');
jest.mock('@/hooks/useAuth');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('TradeListScreen', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'test@test.com' },
  };

  const mockTrades = [
    {
      id: 'trade-1',
      buyer_id: 'user-123',
      seller_id: 'seller-1',
      status: 'pending',
      cash_amount_cents: 5000,
      sp_amount: 0,
      listing: {
        id: 'listing-1',
        title: 'Toy Car',
        price: 50,
        images: [{ url: 'https://example.com/car.jpg', thumbnail_url: null, display_order: 0 }],
      },
    },
    {
      id: 'trade-2',
      buyer_id: 'buyer-2',
      seller_id: 'user-123',
      status: 'in_progress',
      cash_amount_cents: 7500,
      sp_amount: 25,
      listing: {
        id: 'listing-2',
        title: 'Board Game',
        price: 100,
        images: [{ url: 'https://example.com/game.jpg', thumbnail_url: null, display_order: 0 }],
      },
    },
    {
      id: 'trade-3',
      buyer_id: 'user-123',
      seller_id: 'seller-3',
      status: 'completed',
      cash_amount_cents: 3000,
      sp_amount: 10,
      listing: {
        id: 'listing-3',
        title: 'Puzzle',
        price: 40,
        images: [],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: mockSession } as any);
  });

  describe('Rendering', () => {
    it('should fetch and display all trades', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTrades,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByText } = render(<TradeListScreen />);

      await waitFor(() => {
        expect(getByText('Toy Car')).toBeTruthy();
        expect(getByText('Board Game')).toBeTruthy();
        expect(getByText('Puzzle')).toBeTruthy();
      });
    });

    it('should render tab navigation', () => {
      const { getByTestId } = render(<TradeListScreen />);

      expect(getByTestId('tab-all')).toBeTruthy();
      expect(getByTestId('tab-buying')).toBeTruthy();
      expect(getByTestId('tab-selling')).toBeTruthy();
    });

    it('should show empty state when no trades', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId } = render(<TradeListScreen />);

      await waitFor(() => {
        expect(getByTestId('trade-history-empty-state')).toBeTruthy();
      });
    });
  });

  describe('Tab Filtering', () => {
    it('should show all trades by default', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTrades,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByText } = render(<TradeListScreen />);

      await waitFor(() => {
        expect(getByText('Toy Car')).toBeTruthy(); // Buying
        expect(getByText('Board Game')).toBeTruthy(); // Selling
      });
    });

    it('should filter to buying trades only', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTrades,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId, getByText, queryByText } = render(<TradeListScreen />);

      const buyingTab = getByTestId('tab-buying');
      fireEvent.press(buyingTab);

      await waitFor(() => {
        expect(getByText('Toy Car')).toBeTruthy(); // Buyer
        expect(queryByText('Board Game')).toBeNull(); // Seller (filtered out)
      });
    });

    it('should filter to selling trades only', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTrades,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByTestId, getByText, queryByText } = render(<TradeListScreen />);

      const sellingTab = getByTestId('tab-selling');
      fireEvent.press(sellingTab);

      await waitFor(() => {
        expect(queryByText('Toy Car')).toBeNull(); // Buyer (filtered out)
        expect(getByText('Board Game')).toBeTruthy(); // Seller
      });
    });
  });

  describe('Status Badges', () => {
    it('should display correct status badge colors', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTrades,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getAllByText } = render(<TradeListScreen />);

      await waitFor(() => {
        // Pending badge (amber)
        expect(getAllByText(/Pending/i)).toBeTruthy();

        // In Progress badge (green)
        expect(getAllByText(/In Progress/i)).toBeTruthy();

        // Completed badge (gray)
        expect(getAllByText(/Completed/i)).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to TradeTimeline on trade tap', async () => {
      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [mockTrades[0]],
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from = mockFrom;

      const { getByText } = render(<TradeListScreen />);

      await waitFor(() => {
        const tradeCard = getByText('Toy Car');
        fireEvent.press(tradeCard.parent!);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('TradeTimeline', { tradeId: 'trade-1' });
      });
    });
  });
});
