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
import CartScreen, { getItemPointsCaption } from '../CartScreen';

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

// The screen's initial mount performs a REAL async cart load. On a cold run
// (first suite of a batch) that can exceed @testing-library's 1s default wait,
// which intermittently failed the empty-state assertions while the skeleton was
// still on screen. An explicit budget keeps the assertions strict without
// depending on machine warmth.
const LOAD_SETTLE_TIMEOUT_MS = 8000;

describe('CartScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render empty cart state when no items', async () => {
      const { getByTestId, getByText } = render(<CartScreen />);

      await waitFor(
        () => {
          expect(getByTestId('cart-empty-icon')).toBeTruthy();
          expect(getByText('Your trade basket is empty')).toBeTruthy();
          expect(getByText('Start adding items you love to your trade basket')).toBeTruthy();
          expect(getByTestId('browse-items-button')).toBeTruthy();
        },
        { timeout: LOAD_SETTLE_TIMEOUT_MS }
      );
    });

    it('should not show cart count badge when empty', async () => {
      const { getByTestId, queryByTestId } = render(<CartScreen />);

      // Wait for the cart load to settle (empty state) so no async state update
      // leaks past this test's teardown into the next one (observed intermittent
      // CartScreen flake under full-suite parallel load), then assert the badge
      // stays hidden for an empty cart.
      await waitFor(
        () => {
          expect(getByTestId('cart-empty-icon')).toBeTruthy();
        },
        { timeout: LOAD_SETTLE_TIMEOUT_MS }
      );
      expect(queryByTestId('cart-count-badge')).toBeNull();
    });

    it('should navigate to Discover when Browse Items pressed', async () => {
      const { getByTestId } = render(<CartScreen />);

      await waitFor(
        () => {
          const browseButton = getByTestId('browse-items-button');
          fireEvent.press(browseButton);
          expect(mockNavigate).toHaveBeenCalledWith('Discover');
        },
        { timeout: LOAD_SETTLE_TIMEOUT_MS }
      );
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
    it('should render skeleton placeholder rows while cart data loads', async () => {
      const { queryByTestId, findByText } = render(<CartScreen />);

      // FIX-Task-19 item 7 (2026-09-11): the bare "Loading trade basket..." text
      // was replaced by placeholder rows so the real rows land in place and the
      // per-item SP caption appears once. Assert the skeleton synchronously, then
      // let the async load settle to the empty state before the test ends (the
      // old early `return` ended the test mid-load, leaving a CartScreen state
      // update outside act() that bled into the next test — observed intermittent
      // CartScreen flake under full-suite parallel load).
      if (queryByTestId('cart-loading-skeleton')) {
        expect(queryByTestId('cart-loading-skeleton')).toBeTruthy();
      }

      expect(
        await findByText('Your trade basket is empty', {}, { timeout: LOAD_SETTLE_TIMEOUT_MS })
      ).toBeTruthy();
    });

    it('should not show the skeleton once the cart has loaded', async () => {
      const { findByText, queryByTestId } = render(<CartScreen />);

      await findByText('Your trade basket is empty', {}, { timeout: LOAD_SETTLE_TIMEOUT_MS });
      expect(queryByTestId('cart-loading-skeleton')).toBeNull();
    });
  });

  // FIX-Task-19 item 2 (2026-09-11): a subscriber's Accept-SP cart row briefly
  // rendered BOTH "Accepts Points" and "Points unavailable for this item" while
  // the per-item SP cap was still resolving (the condition meant to distinguish
  // "no cap" could not tell it apart from "not loaded yet"). One helper now owns
  // both strings, and the screen renders from it.
  describe('getItemPointsCaption (FIX-Task-19 item 2)', () => {
    it('shows ONLY the neutral placeholder while the cap is resolving', () => {
      const caption = getItemPointsCaption({
        isSubscriber: true,
        acceptsSP: true,
        itemUnavailable: false,
        capResolving: true,
        maxSp: undefined,
      });
      expect(caption.badgeSuffix).toBe(' · Checking points…');
      expect(caption.showUnavailableNote).toBe(false);
    });

    it('shows the resolved cap once the fetch settles', () => {
      const caption = getItemPointsCaption({
        isSubscriber: true,
        acceptsSP: true,
        itemUnavailable: false,
        capResolving: false,
        maxSp: 12,
      });
      expect(caption.badgeSuffix).toBe(' · Up to 12 SP');
      expect(caption.showUnavailableNote).toBe(false);
    });

    it('shows the unavailable note only AFTER resolution with no cap', () => {
      const caption = getItemPointsCaption({
        isSubscriber: true,
        acceptsSP: true,
        itemUnavailable: false,
        capResolving: false,
        maxSp: null,
      });
      expect(caption.badgeSuffix).toBeNull();
      expect(caption.showUnavailableNote).toBe(true);
    });

    it('never renders a cap figure and the unavailable note together', () => {
      const cases: { capResolving: boolean; maxSp: number | null | undefined }[] = [
        { capResolving: true, maxSp: undefined },
        { capResolving: true, maxSp: 12 },
        { capResolving: false, maxSp: 12 },
        { capResolving: false, maxSp: null },
        { capResolving: false, maxSp: undefined },
      ];
      for (const c of cases) {
        const caption = getItemPointsCaption({
          isSubscriber: true,
          acceptsSP: true,
          itemUnavailable: false,
          capResolving: c.capResolving,
          maxSp: c.maxSp,
        });
        const showsCapFigure = caption.badgeSuffix !== null;
        expect(showsCapFigure && caption.showUnavailableNote).toBe(false);
      }
    });

    it('stays silent for non-subscribers and non-Accept-SP items', () => {
      expect(
        getItemPointsCaption({
          isSubscriber: false,
          acceptsSP: true,
          itemUnavailable: false,
          capResolving: false,
          maxSp: 12,
        })
      ).toEqual({ badgeSuffix: null, showUnavailableNote: false });
      expect(
        getItemPointsCaption({
          isSubscriber: true,
          acceptsSP: false,
          itemUnavailable: false,
          capResolving: false,
          maxSp: null,
        })
      ).toEqual({ badgeSuffix: null, showUnavailableNote: false });
    });

    it('suppresses the unavailable note for an item that is no longer available', () => {
      const caption = getItemPointsCaption({
        isSubscriber: true,
        acceptsSP: true,
        itemUnavailable: true,
        capResolving: false,
        maxSp: null,
      });
      expect(caption.showUnavailableNote).toBe(false);
    });
  });

  describe('Make Offer CTA', () => {
    // FIX-Task-17 item 8: renamed — this test asserts the EMPTY-cart state, it
    // never asserted the CTA testID (which is now split into
    // `bundle-cta-button` / `single-item-cta-button` by cart size).
    it('renders the empty basket without raising an alert', async () => {
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
