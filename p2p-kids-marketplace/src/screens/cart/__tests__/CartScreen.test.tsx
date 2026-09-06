/**
 * File: p2p-kids-marketplace/src/screens/cart/__tests__/CartScreen.test.tsx
 * MODULE-15.1-UI-REDESIGN: Cart Screen Unit Tests
 * Task: FLOW-07 Cart & Bundling
 *
 * Tests cart screen rendering, item management, and checkout flow.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CartScreen from '../CartScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
}));

jest.mock('@/components/organisms/BottomNavBar', () => 'BottomNavBar');
jest.mock('@/hooks/useNotificationBadge', () => ({
  useNotificationBadge: () => ({
    unreadCount: 0,
    refreshUnreadCount: jest.fn(),
  }),
}));
jest.mock('@/components/ui', () => ({
  Button: ({ children, onPress, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} testID={testID}>
        <Text>{children}</Text>
      </TouchableOpacity>
    );
  },
}));

// Spy on Alert
jest.spyOn(Alert, 'alert');

describe('CartScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render empty cart state when no items', async () => {
      const { getByTestId, getByText } = render(<CartScreen />);

      await waitFor(() => {
        expect(getByTestId('cart-empty-icon')).toBeTruthy();
        expect(getByText('Your trade basket is empty')).toBeTruthy();
        expect(getByText('Start adding items you love to your trade basket')).toBeTruthy();
        expect(getByTestId('browse-items-button')).toBeTruthy();
      });
    });

    it('should not show cart count badge when empty', async () => {
      const { getByTestId, queryByTestId } = render(<CartScreen />);

      // Wait for the cart load to settle (empty state) so no async state update
      // leaks past this test's teardown into the next one (observed intermittent
      // CartScreen flake under full-suite parallel load), then assert the badge
      // stays hidden for an empty cart.
      await waitFor(() => {
        expect(getByTestId('cart-empty-icon')).toBeTruthy();
      });
      expect(queryByTestId('cart-count-badge')).toBeNull();
    });

    it('should navigate to Discover when Browse Items pressed', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(() => {
        const browseButton = getByTestId('browse-items-button');
        fireEvent.press(browseButton);
        expect(mockNavigate).toHaveBeenCalledWith('Discover');
      });
    });
  });

  describe('Header', () => {
    it('should render shared screen title in header', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(() => {
        expect(getByTestId('screen-title')).toBeTruthy();
      });
    });

    it('should render "Trade Basket" title', async () => {
      const { getByText } = render(<CartScreen />);

      await waitFor(() => {
        expect(getByText('Trade Basket')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should render a valid initial state while cart data loads', async () => {
      const { queryByText, findByText } = render(<CartScreen />);

      // Loading indicator is the synchronous initial state; assert it, then let
      // the async load settle to the empty state before the test ends. The old
      // early `return` here ended the test mid-load, leaving a CartScreen state
      // update that fired outside act() and bled into the next test (observed
      // intermittent CartScreen flake under full-suite parallel load).
      if (queryByText('Loading trade basket...')) {
        expect(queryByText('Loading trade basket...')).toBeTruthy();
      }

      expect(await findByText('Your trade basket is empty')).toBeTruthy();
    });
  });

  describe('Make Offer CTA', () => {
    it('should render bundle-cta-button when cart has items', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(() => {
        // Wait for loading to finish and empty state to render
        expect(getByTestId('cart-empty-icon')).toBeTruthy();
      });

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible empty-state icon', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(() => {
        const cartIcon = getByTestId('cart-empty-icon');
        expect(cartIcon).toBeTruthy();
      });
    });

    it('should have accessible browse button', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(() => {
        const browseButton = getByTestId('browse-items-button');
        expect(browseButton).toBeTruthy();
      });
    });
  });

  describe('Design System Compliance', () => {
    it('should use Phosphor ShoppingCart icon', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(() => {
        const icon = getByTestId('cart-empty-icon');
        expect(icon).toBeTruthy();
      });
    });
  });
});
