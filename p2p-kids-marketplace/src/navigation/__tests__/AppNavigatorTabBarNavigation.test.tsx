/**
 * File: p2p-kids-marketplace/src/navigation/__tests__/AppNavigatorTabBarNavigation.test.tsx
 *
 * INTEGRATION tests for the global bottom nav (PersistentTabBar) — rendered
 * inside a REAL NavigationContainer + stack navigator with stub screens, so
 * tab presses exercise the real navigation state machine (not mocked hooks).
 *
 * Covers (mirrors AUTH-TC-P04/P06/P09/P10 at the component+navigation level):
 *  - all five tabs render on Home
 *  - pressing each tab focuses the real route AND flips the active-tab
 *    selected state (Home active when Home focused, etc.)
 *  - the Sell FAB opens the Sell action sheet (List One Item / Bulk Upload)
 *  - "List One Item" navigates to the ItemCreate route, which HIDES the
 *    floating pill (TAB_BAR_HIDDEN_ROUTES) so the form's CTA is reachable
 *
 * The pure route→tab mapping is unit-tested directly in
 * src/components/organisms/PersistentTabBar/__tests__/PersistentTabBar.test.tsx
 * and the onboarding gate-mount wiring in AppNavigatorOnboardingTabBar.test.tsx.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import { useAuth } from '@/hooks/useAuth';
import { useTradesBadge } from '@/hooks/useTradesBadge';
import { useCartContext } from '@/contexts/CartContext';

// ── Mocks (service/badge deps only — navigation is REAL) ────────────────────
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useTradesBadge', () => ({ useTradesBadge: jest.fn() }));
jest.mock('@/contexts/CartContext', () => ({ useCartContext: jest.fn() }));
jest.mock('@/services/analytics', () => ({ trackEvent: jest.fn() }));

// NOTE: react-native-safe-area-context is intentionally NOT mocked here —
// @react-navigation/stack uses SafeAreaProviderCompat from it, and the existing
// AppNavigatorOnboardingTabBar test renders the same real stack + tab bar
// without a mock (useSafeAreaInsets returns the context default in the env).

jest.mock('phosphor-react-native', () => {
  const React = require('react');
  const { Text: RNText } = require('react-native');
  const MockIcon = () => React.createElement(RNText, null, '•');
  return {
    House: MockIcon,
    MagnifyingGlass: MockIcon,
    Tag: MockIcon,
    Receipt: MockIcon,
    ShoppingCart: MockIcon,
    Package: MockIcon,
  };
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TAB_IDS = ['tab-home', 'tab-discover', 'tab-sell', 'tab-trades', 'tab-basket'];
const Stack = createStackNavigator();

function StubScreen({ testID, label }: { testID: string; label: string }) {
  return (
    <View testID={testID}>
      <Text>{label}</Text>
    </View>
  );
}

// Stub labels are the testID itself so they never collide with the tab labels
// (Home/Discover/Trades/Basket) — getByText('Home') must match the tab only.
const HomeScreen = () => <StubScreen testID="screen-home" label="screen-home" />;
const DiscoverScreen = () => <StubScreen testID="screen-discover" label="screen-discover" />;
const TradeListScreen = () => <StubScreen testID="screen-tradelist" label="screen-tradelist" />;
const CartScreen = () => <StubScreen testID="screen-cart" label="screen-cart" />;
const ItemCreateScreen = () => <StubScreen testID="screen-itemcreate" label="screen-itemcreate" />;

// Reports the FOCUSED route name — the stack keeps previous screens mounted, so
// "is this screen in the tree" is NOT a reliable focus check. This probe is.
// NOTE: as a sibling of the navigator, the container navigation state is
// undefined during the first synchronous render and settles after the
// navigator mounts — hence the defensive selector and the waitFor in tests.
function CurrentRouteProbe() {
  const routeName = useNavigationState((s: any) => s?.routes?.[s.index]?.name);
  return <Text testID="current-route">{String(routeName ?? '')}</Text>;
}

function renderApp() {
  (useAuth as jest.Mock).mockReturnValue({ session: { user: { id: 'user-1' } } });
  (useTradesBadge as jest.Mock).mockReturnValue({ activeCount: 2, refresh: jest.fn() });
  (useCartContext as jest.Mock).mockReturnValue({
    cartCount: 4,
    refreshCartCount: jest.fn(),
    loading: false,
  });

  return render(
    <NavigationContainer>
      <CurrentRouteProbe />
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Discover" component={DiscoverScreen} />
        <Stack.Screen name="TradeList" component={TradeListScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="ItemCreate" component={ItemCreateScreen} />
      </Stack.Navigator>
      <PersistentTabBar />
    </NavigationContainer>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PersistentTabBar — real navigation integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all five tabs with the correct labels on the initial route', () => {
    const { getByTestId, getByText } = renderApp();
    for (const id of TAB_IDS) {
      expect(getByTestId(id)).toBeTruthy();
    }
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Discover')).toBeTruthy();
    expect(getByText('Trades')).toBeTruthy();
    expect(getByText('Basket')).toBeTruthy();
  });

  it('navigates to Discover and flips the active tab when the Discover tab is pressed', async () => {
    const { getByTestId } = renderApp();
    fireEvent.press(getByTestId('tab-discover'));

    await waitFor(() => {
      expect(getByTestId('current-route').props.children).toBe('Discover');
      expect(getByTestId('tab-discover').props.accessibilityState?.selected).toBe(true);
      expect(getByTestId('tab-home').props.accessibilityState?.selected).toBe(false);
    });
  });

  it('navigates to TradeList and marks Trades active', async () => {
    const { getByTestId } = renderApp();
    fireEvent.press(getByTestId('tab-trades'));

    await waitFor(() => {
      expect(getByTestId('current-route').props.children).toBe('TradeList');
      expect(getByTestId('tab-trades').props.accessibilityState?.selected).toBe(true);
    });
  });

  it('navigates to Cart and marks Basket active', async () => {
    const { getByTestId } = renderApp();
    fireEvent.press(getByTestId('tab-basket'));

    await waitFor(() => {
      expect(getByTestId('current-route').props.children).toBe('Cart');
      expect(getByTestId('tab-basket').props.accessibilityState?.selected).toBe(true);
    });
  });

  it('returns Home and restores Home active after tabbing away and back', async () => {
    const { getByTestId } = renderApp();
    fireEvent.press(getByTestId('tab-discover'));
    await waitFor(() => expect(getByTestId('current-route').props.children).toBe('Discover'));

    fireEvent.press(getByTestId('tab-home'));
    await waitFor(() => {
      expect(getByTestId('current-route').props.children).toBe('Home');
      expect(getByTestId('tab-home').props.accessibilityState?.selected).toBe(true);
      expect(getByTestId('tab-discover').props.accessibilityState?.selected).toBe(false);
    });
  });

  it('opens the Sell action sheet with List One Item and Bulk Upload', async () => {
    const { getByTestId } = renderApp();
    fireEvent.press(getByTestId('tab-sell'));
    expect(getByTestId('sell-option-list-one-item')).toBeTruthy();
    expect(getByTestId('sell-option-bulk-upload')).toBeTruthy();
  });

  it('navigates to ItemCreate from "List One Item" and hides the pill on that route', async () => {
    const { getByTestId, queryByTestId } = renderApp();

    fireEvent.press(getByTestId('tab-sell'));
    fireEvent.press(getByTestId('sell-option-list-one-item'));

    // The Sell sheet navigates via a 100ms timeout; wait for the real route flip.
    await waitFor(() => {
      expect(getByTestId('current-route').props.children).toBe('ItemCreate');
    });

    // TAB_BAR_HIDDEN_ROUTES: the floating pill must not render over the form.
    for (const id of TAB_IDS) {
      expect(queryByTestId(id)).toBeNull();
    }
  });
});
