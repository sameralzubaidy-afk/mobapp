/**
 * File: p2p-kids-marketplace/src/screens/cart/__tests__/CartScreen.removeItem.test.tsx
 *
 * FIX-Task-26 round 2, items 2 + 4 (2026-09-13) — QA finding X11-b.
 *
 * A failed `removeFromCart` used to keep the optimistic row deletion and only
 * `console.warn` the failure, so the buyer's basket showed the item gone while it
 * was still in `cart_items` server-side (it would have been re-included in the
 * next offer, and only a later refetch corrected the UI).
 *
 * The row is now restored and an inline retry card explains what happened. These
 * tests drive the REAL confirm-then-remove path (the Alert's own Remove button),
 * not a private helper, so they fail if either the rollback or the card is
 * dropped.
 *
 * NOTE (BP-93): every mocked navigation/context object is a module-level
 * constant. An inline `useNavigation: () => ({ ... })` mock re-creates the
 * screen's `useCallback` chain on every render, which makes the focus effect
 * re-subscribe forever and strands the screen on its loading skeleton.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CartScreen from '../CartScreen';
import { setQaLocalValue, QA_CART_REMOVE_FAILURE_KEY } from '@/services/devTestingService';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRefreshCartCount = jest.fn();
const mockTrackEvent = jest.fn();
const mockCaptureException = jest.fn();
const mockGetCartItems = jest.fn();
const mockRemoveFromCart = jest.fn();
const mockSubscribeToCartChanges = jest.fn(() => jest.fn());

// Identity-stable mocks (BP-93).
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockCartContext = { refreshCartCount: mockRefreshCartCount };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const ReactLib = require('react');
    ReactLib.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
}));

jest.mock('@/contexts/CartContext', () => ({
  useCartContext: () => mockCartContext,
}));

jest.mock('@/services/cartService', () => ({
  getCartItems: (...args: unknown[]) => mockGetCartItems(...args),
  removeFromCart: (...args: unknown[]) => mockRemoveFromCart(...args),
  saveCurrentCart: jest.fn(),
  switchToSavedCart: jest.fn(),
  clearCart: jest.fn(),
  validateCartForCheckout: jest.fn(),
  subscribeToCartChanges: (...args: unknown[]) => mockSubscribeToCartChanges(...args),
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/services/errorReporter', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('@/services/listing', () => ({
  getMaskedSellerListings: jest.fn(async () => ({ total_count: 0 })),
}));

jest.mock('@/services/categoryService', () => ({
  calculateCategorySP: jest.fn(async () => null),
  getItemEffectiveSpCap: jest.fn(async () => null),
}));

jest.mock('@/components/molecules/DifferentSellerModal', () => ({
  showDifferentSellerModal: jest.fn(),
}));

jest.mock('@/components/organisms/BottomNavBar', () => 'BottomNavBar');

jest.mock('@/hooks/useNotificationBadge', () => ({
  useNotificationBadge: () => ({ unreadCount: 0, refreshUnreadCount: jest.fn() }),
}));

jest.mock('@/components/ui', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ children, onPress, testID }: Record<string, unknown>) => (
      <TouchableOpacity onPress={onPress as () => void} testID={testID as string}>
        <Text>{children as string}</Text>
      </TouchableOpacity>
    ),
    Modal: () => null,
  };
});

/** Two-item basket, one seller — the minimum the removal path needs. */
const ITEM_A = {
  id: 'A',
  listingId: 'listing-A',
  sellerId: 'seller-1',
  bundleId: 'bundle-1',
  addedAt: '2026-09-13T00:00:00Z',
  title: 'Scooter',
  price: 15,
  imageUrl: '',
};
const ITEM_B = {
  id: 'B',
  listingId: 'listing-B',
  sellerId: 'seller-1',
  bundleId: 'bundle-1',
  addedAt: '2026-09-13T00:00:00Z',
  title: 'Helmet',
  price: 15,
  imageUrl: '',
};

const cartWithTwoItems = {
  success: true as const,
  data: {
    items: [ITEM_A, ITEM_B],
    sellerId: 'seller-1',
    bundleId: 'bundle-1',
    subtotal: 30,
    savedCarts: [],
    isSubscriber: false,
  },
};

const REMOVAL_FAILED = {
  success: false as const,
  error: { code: 'RPC_FAILED', message: 'Gateway Timeout' },
};
const REMOVAL_OK = { success: true as const, data: { removed: true } };

/** Captured buttons from the most recent Alert, so the real confirm path runs. */
let lastAlertButtons: { text?: string; onPress?: () => void }[] = [];

const pressRemoveInAlert = async () => {
  const removeButton = lastAlertButtons.find((b) => b.text === 'Remove');
  expect(removeButton?.onPress).toBeDefined();
  await act(async () => {
    await removeButton!.onPress!();
  });
};

describe('CartScreen — item removal failure handling (FIX-Task-26 round 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastAlertButtons = [];
    mockSubscribeToCartChanges.mockReturnValue(jest.fn());
    mockGetCartItems.mockResolvedValue(cartWithTwoItems);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      lastAlertButtons = (buttons ?? []) as typeof lastAlertButtons;
    });
  });

  it('restores the row and shows the inline retry when the removal write fails', async () => {
    mockRemoveFromCart.mockResolvedValue(REMOVAL_FAILED);

    const { getByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    fireEvent.press(getByTestId('cart-item-remove-A'));
    await pressRemoveInAlert();

    // The row is BACK — the UI no longer claims an item is gone when it isn't.
    expect(getByTestId('cart-item-A')).toBeTruthy();
    expect(getByTestId('cart-item-B')).toBeTruthy();

    // …and the failure is explained, with a retry, instead of a console-only warn.
    expect(getByTestId('cart-remove-error-card')).toBeTruthy();
    expect(getByTestId('cart-remove-retry-button')).toBeTruthy();

    // A removal that never persisted must not be reported as a removal.
    expect(mockTrackEvent).not.toHaveBeenCalledWith('cart_item_removed', expect.anything());
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('does NOT refetch the cart after a failed removal (no surprise resurrection)', async () => {
    mockRemoveFromCart.mockResolvedValue(REMOVAL_FAILED);

    const { getByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');
    expect(mockGetCartItems).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('cart-item-remove-A'));
    await pressRemoveInAlert();

    expect(mockGetCartItems).toHaveBeenCalledTimes(1);
  });

  it('removes the row, records analytics and shows no error card on success', async () => {
    mockRemoveFromCart.mockResolvedValue(REMOVAL_OK);
    // The refetch after a successful removal returns the remaining item.
    mockGetCartItems
      .mockResolvedValueOnce(cartWithTwoItems)
      .mockResolvedValue({
        ...cartWithTwoItems,
        data: { ...cartWithTwoItems.data, items: [ITEM_B] },
      });

    const { getByTestId, queryByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    fireEvent.press(getByTestId('cart-item-remove-A'));
    await pressRemoveInAlert();

    await waitFor(() => expect(queryByTestId('cart-item-A')).toBeNull());
    expect(queryByTestId('cart-remove-error-card')).toBeNull();
    expect(mockTrackEvent).toHaveBeenCalledWith('cart_item_removed', {
      listing_id: 'listing-A',
      reason: 'user_action',
    });
  });

  it('retry re-runs the removal through the same path and clears the card', async () => {
    mockRemoveFromCart.mockResolvedValueOnce(REMOVAL_FAILED).mockResolvedValueOnce(REMOVAL_OK);
    mockGetCartItems
      .mockResolvedValueOnce(cartWithTwoItems)
      .mockResolvedValue({
        ...cartWithTwoItems,
        data: { ...cartWithTwoItems.data, items: [ITEM_B] },
      });

    const { getByTestId, queryByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    fireEvent.press(getByTestId('cart-item-remove-A'));
    await pressRemoveInAlert();
    await findByTestId('cart-remove-error-card');

    fireEvent.press(getByTestId('cart-remove-retry-button'));

    await waitFor(() => expect(queryByTestId('cart-remove-error-card')).toBeNull());
    expect(queryByTestId('cart-item-A')).toBeNull();
    expect(mockRemoveFromCart).toHaveBeenCalledTimes(2);
  });
});

/**
 * FIX-Task-27 item 4 (2026-09-13) — the `cart_remove_failure` QA toggle.
 *
 * The rollback above was provable only by making `removeFromCart` fail inside a
 * unit test: on-device there was no way to induce it (airplane mode trips the
 * app's global offline gate before any per-request failure can surface). This
 * pins the toggle's wiring — armed, the removal short-circuits BEFORE the service
 * call, so the server cart is never touched, and the user-visible result is the
 * identical rollback + retry card.
 */
describe('CartScreen — qa cart_remove_failure toggle (FIX-Task-27 item 4)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    lastAlertButtons = [];
    await AsyncStorage.clear();
    mockSubscribeToCartChanges.mockReturnValue(jest.fn());
    mockGetCartItems.mockResolvedValue(cartWithTwoItems);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      lastAlertButtons = (buttons ?? []) as typeof lastAlertButtons;
    });
  });

  it('armed: fails the removal WITHOUT calling the service, and rolls the row back', async () => {
    await setQaLocalValue(QA_CART_REMOVE_FAILURE_KEY, 'remove_failure');
    mockRemoveFromCart.mockResolvedValue(REMOVAL_OK); // would succeed if it ran

    const { getByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    fireEvent.press(getByTestId('cart-item-remove-A'));
    await pressRemoveInAlert();

    expect(mockRemoveFromCart).not.toHaveBeenCalled();
    expect(getByTestId('cart-item-A')).toBeTruthy();
    expect(getByTestId('cart-remove-error-card')).toBeTruthy();
    expect(getByTestId('cart-remove-retry-button')).toBeTruthy();
  });

  it('disarmed: the same tap writes normally and clears the basket', async () => {
    await setQaLocalValue(QA_CART_REMOVE_FAILURE_KEY, 'none');
    mockRemoveFromCart.mockResolvedValue(REMOVAL_OK);
    // The refetch after a successful removal returns the remaining item.
    mockGetCartItems
      .mockResolvedValueOnce(cartWithTwoItems)
      .mockResolvedValue({
        ...cartWithTwoItems,
        data: { ...cartWithTwoItems.data, items: [ITEM_B] },
      });

    const { getByTestId, queryByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    fireEvent.press(getByTestId('cart-item-remove-A'));
    await pressRemoveInAlert();

    expect(mockRemoveFromCart).toHaveBeenCalledWith('A');
    await waitFor(() => expect(queryByTestId('cart-item-A')).toBeNull());
    expect(queryByTestId('cart-remove-error-card')).toBeNull();
  });
});

/**
 * FIX-Task-30 item 4 (2026-09-13) — the Clear-Basket accessibility label did not
 * pluralise: it announced "Clear basket, removes all 1 items" while the visible
 * hint directly beneath it already read "Removes all 1 item". A screen reader
 * therefore heard ungrammatical copy that contradicted the on-screen text.
 *
 * These tests drive the REAL rendered control (not a helper) so they fail if the
 * label ever reverts to a bare `${n} items` template.
 */
describe('CartScreen — clear-basket a11y label pluralisation (FIX-Task-30 item 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastAlertButtons = [];
    mockSubscribeToCartChanges.mockReturnValue(jest.fn());
  });

  it('uses the singular "item" when exactly one item is in the basket', async () => {
    mockGetCartItems.mockResolvedValue({
      ...cartWithTwoItems,
      data: { ...cartWithTwoItems.data, items: [ITEM_A], subtotal: 15 },
    });

    const { getByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    expect(getByTestId('clear-basket-button').props.accessibilityLabel).toBe(
      'Clear basket, removes all 1 item'
    );
    // The visible consequence line agrees with the spoken label.
    expect(getByTestId('clear-basket-button')).toBeTruthy();
  });

  it('uses the plural "items" when more than one item is in the basket', async () => {
    mockGetCartItems.mockResolvedValue(cartWithTwoItems);

    const { getByTestId, findByTestId } = render(<CartScreen />);
    await findByTestId('cart-item-A');

    expect(getByTestId('clear-basket-button').props.accessibilityLabel).toBe(
      'Clear basket, removes all 2 items'
    );
  });
});
