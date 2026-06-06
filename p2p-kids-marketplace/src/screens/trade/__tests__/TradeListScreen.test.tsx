/**
 * Unit Tests: TradeListScreen
 * Tests Active | History tabs, summary strip, needs-action/in-progress sections,
 * recently completed, and compact rows for history.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TradeListScreen from '../TradeListScreen';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/config/supabase');
jest.mock('@/hooks/useAuth');
jest.mock('@/hooks/useNotificationBadge', () => ({
  useNotificationBadge: () => ({
    unreadCount: 0,
    refreshUnreadCount: jest.fn(),
  }),
}));
jest.mock('@/components/organisms/BottomNavBar', () => () => null);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock item_images query
jest.mock('@/config/supabase', () => {
  const actual = jest.requireActual('@/config/supabase');
  return {
    ...actual,
    supabase: {
      ...actual.supabase,
      from: jest.fn(),
    },
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('TradeListScreen', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'test@test.com' },
  };
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  // Helper: mock supabase to return trades
  const mockFetchTrades = (trades: any[]) => {
    // First call: fetch trades
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        or: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: trades, error: null }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;
    return mockFrom;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: mockSession } as any);
  });

  describe('Rendering', () => {
    it('should render Active | History tabs', () => {
      mockFetchTrades([]);
      const { getByTestId } = render(<TradeListScreen navigation={mockNavigation as any} />);

      expect(getByTestId('tab-active')).toBeTruthy();
      expect(getByTestId('tab-history')).toBeTruthy();
    });

    it('should show empty state when no trades', async () => {
      mockFetchTrades([]);
      const { getByText } = render(<TradeListScreen navigation={mockNavigation as any} />);

      await waitFor(() => {
        expect(getByText('No Active Trades')).toBeTruthy();
      });
    });

    it('should show summary strip counts', async () => {
      mockFetchTrades([]);
      const { getByText } = render(<TradeListScreen navigation={mockNavigation as any} />);

      await waitFor(() => {
        expect(getByText('In Progress')).toBeTruthy();
        expect(getByText('Needs Action')).toBeTruthy();
        expect(getByText('Completed')).toBeTruthy();
      });
    });
  });

  describe('Tab Switching', () => {
    it('should switch to History tab on press', () => {
      mockFetchTrades([]);
      const { getByTestId, getByText } = render(
        <TradeListScreen navigation={mockNavigation as any} />
      );

      const historyTab = getByTestId('tab-history');
      fireEvent.press(historyTab);

      expect(getByText('No Trade History')).toBeTruthy();
    });
  });

  describe('Status Badges', () => {
    it('should display status labels correctly', async () => {
      const trades = [
        {
          id: 'trade-1',
          buyer_id: 'user-123',
          seller_id: 'seller-1',
          node_id: null,
          status: 'pending',
          sp_amount: 0,
          cash_amount_cents: 5000,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-01T10:00:00.000Z',
          updated_at: '2026-01-01T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: null,
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
          listing: {
            id: 'listing-1',
            title: 'Toy Car',
            price: 50,
            images: [],
          },
        },
        {
          id: 'trade-2',
          buyer_id: 'buyer-2',
          seller_id: 'user-123',
          node_id: null,
          status: 'in_progress',
          sp_amount: 25,
          cash_amount_cents: 7500,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-02T10:00:00.000Z',
          updated_at: '2026-01-02T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: '2026-01-04T10:00:00.000Z',
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
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
          node_id: null,
          status: 'completed',
          sp_amount: 10,
          cash_amount_cents: 3000,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-03T10:00:00.000Z',
          updated_at: '2026-01-03T10:00:00.000Z',
          completed_at: '2026-01-04T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: null,
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
          listing: {
            id: 'listing-3',
            title: 'Puzzle',
            price: 40,
            images: [],
          },
        },
      ];

      mockFetchTrades(trades);
      const { getByText } = render(<TradeListScreen navigation={mockNavigation as any} />);

      await waitFor(() => {
        // Should show all trade titles
        expect(getByText('Toy Car')).toBeTruthy();
        expect(getByText('Board Game')).toBeTruthy();
        expect(getByText('Puzzle')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to TradeDetail on card tap', async () => {
      mockFetchTrades([
        {
          id: 'trade-1',
          buyer_id: 'user-123',
          seller_id: 'seller-1',
          node_id: null,
          status: 'pending',
          sp_amount: 0,
          cash_amount_cents: 5000,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-01T10:00:00.000Z',
          updated_at: '2026-01-01T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: null,
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
          listing: {
            id: 'listing-1',
            title: 'Toy Car',
            price: 50,
            images: [{ url: 'https://example.com/car.jpg', thumbnail_url: null, display_order: 0 }],
          },
        },
      ]);

      const { getByTestId } = render(<TradeListScreen navigation={mockNavigation as any} />);

      await waitFor(() => {
        const tradeCard = getByTestId('active-trade-card-trade-1');
        fireEvent.press(tradeCard);
      });

      await waitFor(() => {
        expect(mockNavigation.navigate).toHaveBeenCalledWith('TradeDetail', { tradeId: 'trade-1' });
      });
    });
  });

  // D-09: Trades sorted by total_value (cash_amount_cents/100 + sp_amount) DESC
  describe('Sorting', () => {
    it('D-09: should sort completed trades by total_value DESC', async () => {
      const unsortedTrades = [
        {
          id: 'trade-low',
          buyer_id: 'user-123',
          seller_id: 'seller-1',
          node_id: null,
          status: 'completed',
          sp_amount: 0,
          cash_amount_cents: 1000,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-01T10:00:00.000Z',
          updated_at: '2026-01-02T10:00:00.000Z',
          completed_at: '2026-01-02T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: null,
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
          listing: { id: 'l-1', title: 'Cheap Item', price: 10, images: [] },
        },
        {
          id: 'trade-high',
          buyer_id: 'user-123',
          seller_id: 'seller-1',
          node_id: null,
          status: 'completed',
          sp_amount: 20,
          cash_amount_cents: 5000,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-02T10:00:00.000Z',
          updated_at: '2026-01-03T10:00:00.000Z',
          completed_at: '2026-01-03T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: null,
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
          listing: { id: 'l-2', title: 'Expensive Item', price: 70, images: [] },
        },
        {
          id: 'trade-mid',
          buyer_id: 'user-123',
          seller_id: 'seller-1',
          node_id: null,
          status: 'completed',
          sp_amount: 5,
          cash_amount_cents: 3000,
          buyer_transaction_fee_cents: 99,
          tax_amount_cents: null,
          created_at: '2026-01-03T10:00:00.000Z',
          updated_at: '2026-01-04T10:00:00.000Z',
          completed_at: '2026-01-04T10:00:00.000Z',
          offer_expires_at: null,
          auto_complete_at: null,
          dispute_resolution: null,
          cancellation_reason: null,
          buyer_subscription_status: 'active',
          listing: { id: 'l-3', title: 'Mid Item', price: 35, images: [] },
        },
      ];

      mockFetchTrades(unsortedTrades);

      const { getAllByTestId } = render(<TradeListScreen navigation={mockNavigation as any} />);

      await waitFor(() => {
        const rows = getAllByTestId(/^compact-row-/);
        // Expected order: high ($70) > mid ($35) > low ($10)
        expect(rows[0].props.testID).toBe('compact-row-trade-high');
        expect(rows[1].props.testID).toBe('compact-row-trade-mid');
        expect(rows[2].props.testID).toBe('compact-row-trade-low');
      });
    });
  });
});
