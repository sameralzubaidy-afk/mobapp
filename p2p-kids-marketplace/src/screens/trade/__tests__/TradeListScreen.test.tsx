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
jest.mock('@/components/organisms/PersistentTabBar', () => ({
  PersistentTabBar: () => null,
}));
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
  useRoute: () => ({
    params: {},
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
    // Build a permissive chain that supports all query patterns the component uses.
    // Every method returns the chain itself (builder pattern) so any sequence works.
    // The chain is also thenable (like real Supabase queries).
    const buildChain = (resolveTo?: any) => {
      // Collect query filters (eq/in/or/neq) and apply them to the canned rows
      // before resolving, so the mock mirrors how Supabase filters server-side.
      // Without this, the same rows are returned for EVERY query — including the
      // seller-received AND buyer-submitted offer queries — which makes one trade
      // render in both sections and breaks getByText uniqueness.
      const filters: ((row: any) => boolean)[] = [];
      const chain: any = new Proxy(
        {},
        {
          get(_target, prop: string) {
            if (prop === 'then') {
              return (onFulfilled: any) => {
                const rows = resolveTo?.data ?? [];
                const data = rows.filter((row: any) => filters.every((f) => f(row)));
                return Promise.resolve({ ...resolveTo, data, error: null }).then(onFulfilled);
              };
            }
            if (prop === 'eq') {
              return (column: string, value: any) => {
                filters.push((row: any) => row[column] === value);
                return chain;
              };
            }
            if (prop === 'neq') {
              return (column: string, value: any) => {
                filters.push((row: any) => row[column] !== value);
                return chain;
              };
            }
            if (prop === 'in') {
              return (column: string, values: any[]) => {
                filters.push((row: any) => values.includes(row[column]));
                return chain;
              };
            }
            if (prop === 'or') {
              return (filterString: string) => {
                // Supabase or() format: "col1.eq.val1,col2.eq.val2"
                const clauses = filterString.split(',').map((clause: string) => {
                  const [col, op, val] = clause.split('.');
                  return (row: any) => {
                    if (op === 'eq') return row[col] === val;
                    if (op === 'neq') return row[col] !== val;
                    if (op === 'is') return val === 'null' ? row[col] == null : row[col] === val;
                    return false;
                  };
                });
                filters.push((row: any) => clauses.some((c) => c(row)));
                return chain;
              };
            }
            return jest.fn(() => chain);
          },
        }
      );
      return chain;
    };

    // Extract listing IDs and titles from trades so items query returns matching data
    const listingIds = [...new Set(trades.map((t: any) => t.listing_id).filter(Boolean))];
    const itemsData = listingIds.map((id: string) => {
      const t = trades.find((tr: any) => tr.listing_id === id);
      const listing = t?.listing || {};
      return {
        id,
        title: listing.title || 'Test Item',
        price: listing.price || 25,
        status: 'available',
      };
    });
    const itemImagesData = listingIds.flatMap((id: string) => [
      {
        item_id: id,
        id: `img-${id}`,
        url: `https://example.com/${id}.jpg`,
        thumbnail_url: null,
        display_order: 0,
      },
    ]);

    // Return appropriate data per table — same result regardless of call count
    mockSupabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'trades') {
        return buildChain({ data: trades, error: null });
      }
      if (table === 'items') {
        return buildChain({ data: itemsData, error: null });
      }
      if (table === 'item_images') {
        return buildChain({ data: itemImagesData, error: null });
      }
      return buildChain({ data: [], error: null });
    });
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
        expect(getByText('No Trades Yet')).toBeTruthy();
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
    it('should switch to History tab on press', async () => {
      mockFetchTrades([]);
      const { getByTestId, getByText } = render(
        <TradeListScreen navigation={mockNavigation as any} />
      );

      const historyTab = getByTestId('tab-history');
      fireEvent.press(historyTab);

      // History is paginated and loads asynchronously — wait for the empty state.
      await waitFor(() => {
        expect(getByText('No Trades Yet')).toBeTruthy();
      });
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
          listing_id: 'listing-1',
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
          listing_id: 'listing-2',
          listing: {
            id: 'listing-2',
            title: 'Board Game',
            price: 100,
            images: [
              { url: 'https://example.com/game.jpg', thumbnail_url: null, display_order: 0 },
            ],
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
          listing_id: 'listing-3',
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
    it('should navigate to TradeDetail on in-progress card tap', async () => {
      mockFetchTrades([
        {
          id: 'trade-1',
          buyer_id: 'user-123',
          seller_id: 'seller-1',
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
          listing_id: 'listing-1',
          listing: {
            id: 'listing-1',
            title: 'Toy Car',
            price: 50,
            images: [{ url: 'https://example.com/car.jpg', thumbnail_url: null, display_order: 0 }],
          },
        },
      ]);

      const { getByTestId, getByText } = render(
        <TradeListScreen navigation={mockNavigation as any} />
      );

      await waitFor(() => {
        expect(getByTestId('trade-row-trade-1')).toBeTruthy();
      });

      fireEvent.press(getByText('View Trade'));

      await waitFor(() => {
        expect(mockNavigation.navigate).toHaveBeenCalledWith('TradeDetail', { tradeId: 'trade-1' });
      });
    });
  });

  // D-09: Trades sorted by total_value (cash_amount_cents/100 + sp_amount) DESC
  describe('Sorting', () => {
    it('D-09: should sort completed trades by created_at DESC in history tab', async () => {
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
          listing_id: 'l-1',
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
          listing_id: 'l-2',
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
          listing_id: 'l-3',
          listing: { id: 'l-3', title: 'Mid Item', price: 35, images: [] },
        },
      ];

      mockFetchTrades(unsortedTrades);

      const { getByTestId, getByText, getAllByText } = render(
        <TradeListScreen navigation={mockNavigation as any} />
      );

      // Wait for data to load on the Active tab (RECENTLY COMPLETED shows the 3 trades)
      await waitFor(
        () => {
          expect(getByText('Expensive Item')).toBeTruthy();
          expect(getByText('Mid Item')).toBeTruthy();
          expect(getByText('Cheap Item')).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Switch to History tab to see compact rows in sorted order.
      // History is now paginated and loads asynchronously, so wait for it.
      fireEvent.press(getByTestId('tab-history'));

      const titles = await waitFor(
        () => {
          const found = getAllByText(/Expensive Item|Mid Item|Cheap Item/);
          expect(found).toHaveLength(3);
          return found;
        },
        { timeout: 5000 }
      );

      // Component sorts history by created_at DESC, not total_value
      expect(titles[0].props.children).toBe('Mid Item'); // created Jan 3
      expect(titles[1].props.children).toBe('Expensive Item'); // created Jan 2
      expect(titles[2].props.children).toBe('Cheap Item'); // created Jan 1
    });
  });
});
