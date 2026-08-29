/**
 * File: p2p-kids-marketplace/src/components/organisms/PersistentTabBar/__tests__/PersistentTabBar.test.tsx
 *
 * Unit tests for the floating pill bottom nav (the global "menu bar"):
 *
 *  1. `computeActiveTab` — the pure route→active-tab mapping (every branch):
 *     Home/HomeDash → Home, Discover → Discover, trade screens → Trades,
 *     Cart/CartCheckout → Cart, the stack walk-back for pushed detail screens,
 *     and the null cases (empty / unknown routes).
 *
 *  2. The rendered component — all five tabs present with correct labels, the
 *     active tab's selected state follows the navigation route, tab presses
 *     navigate to the right route, the Trades/Basket badges render their
 *     counts, the Sell FAB opens the Sell action sheet (List One Item / Bulk
 *     Upload / Cancel), and the bar is hidden on the ItemCreate full-screen
 *     form.
 *
 * The integration-level navigation behavior (real NavigationContainer + stack,
 * tab press → screen focused) is covered separately in
 * src/navigation/__tests__/AppNavigatorTabBarNavigation.test.tsx.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PersistentTabBar, { computeActiveTab } from '../index';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { useTradesBadge } from '@/hooks/useTradesBadge';
import { useCartContext } from '@/contexts/CartContext';
import { trackEvent } from '@/services/analytics';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useTradesBadge', () => ({ useTradesBadge: jest.fn() }));
jest.mock('@/contexts/CartContext', () => ({ useCartContext: jest.fn() }));
jest.mock('@/services/analytics', () => ({ trackEvent: jest.fn() }));

// Navigation is mocked at unit level (real-navigation behavior lives in the
// integration test). useNavigationState applies the selector to a controllable
// nav state so each test can drive the active-tab mapping.
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useNavigationState: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 34, left: 0, right: 0 })),
}));

// Phosphor icons render via react-native-svg; stub them for the test env.
jest.mock('phosphor-react-native', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = () => React.createElement(Text, null, '•');
  return {
    House: MockIcon,
    MagnifyingGlass: MockIcon,
    Tag: MockIcon,
    Receipt: MockIcon,
    ShoppingCart: MockIcon,
    Package: MockIcon,
  };
});

// ── Fixtures / helpers ───────────────────────────────────────────────────────

const TAB_IDS = ['tab-home', 'tab-discover', 'tab-sell', 'tab-trades', 'tab-basket'];

const mockNavigate = jest.fn();
let mockNavState: { routes: { name: string }[]; index: number };

function makeState(routeNames: string[], index: number) {
  return {
    routes: routeNames.map((name, i) => ({ name, key: `${name}-${i}` })),
    index,
  };
}

function setup(state = makeState(['Home'], 0)) {
  mockNavState = state;
  (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
  (useNavigationState as jest.Mock).mockImplementation((selector: (s: unknown) => unknown) =>
    selector(mockNavState)
  );
  (useAuth as jest.Mock).mockReturnValue({ session: { user: { id: 'user-1' } } });
  (useTradesBadge as jest.Mock).mockReturnValue({ activeCount: 0, refresh: jest.fn() });
  (useCartContext as jest.Mock).mockReturnValue({
    cartCount: 0,
    refreshCartCount: jest.fn(),
    loading: false,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeActiveTab — route → active tab mapping', () => {
  it('returns null for undefined or empty navigation state', () => {
    expect(computeActiveTab(undefined)).toBeNull();
    expect(computeActiveTab({ routes: [], index: 0 })).toBeNull();
  });

  it('maps Home and HomeDash to Home', () => {
    expect(computeActiveTab(makeState(['Home'], 0))).toBe('Home');
    expect(computeActiveTab(makeState(['HomeDash'], 0))).toBe('Home');
  });

  it('maps Discover to Discover', () => {
    expect(computeActiveTab(makeState(['Discover'], 0))).toBe('Discover');
  });

  it('maps every trade flow screen to Trades', () => {
    const tradeRoutes = [
      'TradeList',
      'TradeTimeline',
      'TradeDetail',
      'TradeSuccess',
      'ReviewOffer',
      'TradeInitiation',
    ];
    for (const r of tradeRoutes) {
      expect(computeActiveTab(makeState([r], 0))).toBe('Trades');
    }
  });

  it('maps Cart and CartCheckout to Cart', () => {
    expect(computeActiveTab(makeState(['Cart'], 0))).toBe('Cart');
    expect(computeActiveTab(makeState(['CartCheckout'], 0))).toBe('Cart');
  });

  it('walks back through the stack to find the owning tab for pushed detail screens', () => {
    // Listing detail pushed from Home
    expect(computeActiveTab(makeState(['Home', 'ListingDetail'], 1))).toBe('Home');
    // Listing detail pushed from Discover
    expect(computeActiveTab(makeState(['Home', 'Discover', 'ListingDetail'], 2))).toBe('Discover');
  });

  it('returns null only when no route in the stack is a known tab', () => {
    expect(computeActiveTab(makeState(['SomeUnknownScreen'], 0))).toBeNull();
  });

  it('inherits the owning tab for unknown pushed screens via the stack walk-back', () => {
    // An unknown detail screen pushed from Home keeps Home active.
    expect(computeActiveTab(makeState(['Home', 'SomeUnknownScreen'], 1))).toBe('Home');
    // ...and pushed from Cart keeps Cart active.
    expect(computeActiveTab(makeState(['Home', 'Cart', 'SomeUnknownScreen'], 2))).toBe('Cart');
  });
});

describe('PersistentTabBar — component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setup();
  });

  it('renders all five tabs with the correct labels', () => {
    const { getByTestId, getByText } = render(<PersistentTabBar />);
    for (const id of TAB_IDS) {
      expect(getByTestId(id)).toBeTruthy();
    }
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Discover')).toBeTruthy();
    expect(getByText('Trades')).toBeTruthy();
    expect(getByText('Basket')).toBeTruthy();
  });

  it('marks only the active tab as selected for the current route', () => {
    setup(makeState(['Discover'], 0));
    const { getByTestId } = render(<PersistentTabBar />);
    expect(getByTestId('tab-discover').props.accessibilityState?.selected).toBe(true);
    expect(getByTestId('tab-home').props.accessibilityState?.selected).toBe(false);
    expect(getByTestId('tab-trades').props.accessibilityState?.selected).toBe(false);
    expect(getByTestId('tab-basket').props.accessibilityState?.selected).toBe(false);
  });

  it('highlights Trades when on a trade sub-screen (TradeTimeline)', () => {
    setup(makeState(['Home', 'TradeTimeline'], 1));
    const { getByTestId } = render(<PersistentTabBar />);
    expect(getByTestId('tab-trades').props.accessibilityState?.selected).toBe(true);
    expect(getByTestId('tab-home').props.accessibilityState?.selected).toBe(false);
  });

  it('navigates to the correct route when each tab is pressed', () => {
    const { getByTestId } = render(<PersistentTabBar />);
    fireEvent.press(getByTestId('tab-discover'));
    expect(mockNavigate).toHaveBeenCalledWith('Discover');
    fireEvent.press(getByTestId('tab-trades'));
    expect(mockNavigate).toHaveBeenCalledWith('TradeList');
    fireEvent.press(getByTestId('tab-basket'));
    expect(mockNavigate).toHaveBeenCalledWith('Cart');
    fireEvent.press(getByTestId('tab-home'));
    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });

  it('tracks the analytics event when a tab is tapped', () => {
    const { getByTestId } = render(<PersistentTabBar />);
    fireEvent.press(getByTestId('tab-home'));
    expect(trackEvent).toHaveBeenCalledWith('tab_home_tapped');
  });

  it('renders nothing on the ItemCreate full-screen form', () => {
    setup(makeState(['ItemCreate'], 0));
    const { queryByTestId } = render(<PersistentTabBar />);
    for (const id of TAB_IDS) {
      expect(queryByTestId(id)).toBeNull();
    }
  });

  it('renders the Trades badge with the active trade count', () => {
    (useTradesBadge as jest.Mock).mockReturnValue({ activeCount: 3, refresh: jest.fn() });
    const { getByTestId, getByText } = render(<PersistentTabBar />);
    expect(getByTestId('tab-trades-badge')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders the Basket badge with the cart count', () => {
    (useCartContext as jest.Mock).mockReturnValue({
      cartCount: 5,
      refreshCartCount: jest.fn(),
      loading: false,
    });
    const { getByTestId, getByText } = render(<PersistentTabBar />);
    expect(getByTestId('tab-basket-badge')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('does not render badges when counts are zero', () => {
    const { queryByTestId } = render(<PersistentTabBar />);
    expect(queryByTestId('tab-trades-badge')).toBeNull();
    expect(queryByTestId('tab-basket-badge')).toBeNull();
  });

  it('caps the badge at 99+', () => {
    (useTradesBadge as jest.Mock).mockReturnValue({ activeCount: 120, refresh: jest.fn() });
    const { getByTestId, getByText } = render(<PersistentTabBar />);
    expect(getByTestId('tab-trades-badge')).toBeTruthy();
    expect(getByText('99+')).toBeTruthy();
  });

  it('opens the Sell action sheet and closes it on Cancel', () => {
    const { getByTestId, getByText, queryByTestId } = render(<PersistentTabBar />);
    fireEvent.press(getByTestId('tab-sell'));
    expect(getByTestId('sell-option-list-one-item')).toBeTruthy();
    expect(getByTestId('sell-option-bulk-upload')).toBeTruthy();
    fireEvent.press(getByText('Cancel'));
    expect(queryByTestId('sell-option-list-one-item')).toBeNull();
    expect(queryByTestId('sell-option-bulk-upload')).toBeNull();
  });

  it('navigates to ItemCreate from the Sell sheet "List One Item"', () => {
    jest.useFakeTimers();
    const { getByTestId } = render(<PersistentTabBar />);
    fireEvent.press(getByTestId('tab-sell'));
    fireEvent.press(getByTestId('sell-option-list-one-item'));
    jest.runAllTimers();
    expect(mockNavigate).toHaveBeenCalledWith('ItemCreate');
    jest.useRealTimers();
  });

  it('navigates to BulkListingCreate from the Sell sheet "Bulk Upload"', () => {
    jest.useFakeTimers();
    const { getByTestId } = render(<PersistentTabBar />);
    fireEvent.press(getByTestId('tab-sell'));
    fireEvent.press(getByTestId('sell-option-bulk-upload'));
    jest.runAllTimers();
    expect(mockNavigate).toHaveBeenCalledWith('BulkListingCreate');
    jest.useRealTimers();
  });
});
