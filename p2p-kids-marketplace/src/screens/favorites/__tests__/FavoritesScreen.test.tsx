/**
 * File: p2p-kids-marketplace/src/screens/favorites/__tests__/FavoritesScreen.test.tsx
 * FIX-Task-29 item 1: Favorites must refetch on FOCUS, not only on mount.
 *
 * Regression being locked in: favouriting an item from Discover and then opening
 * Favorites reused the already-mounted screen, so a mount-only fetch left
 * "No favorites yet" on screen even though the `favorites` row existed in the DB.
 * The focus refetch must replace that stale snapshot.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import FavoritesScreen from '../FavoritesScreen';
import { getFavorites } from '@/services/favoritesService';

jest.mock('@/services/favoritesService');

// Identity-stable navigation object (BP-93) so mocked hooks never re-create the
// screen's callbacks between renders.
const mockNavigation = { navigate: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
}));

const mockUseFocusEffect = require('@react-navigation/native').useFocusEffect as jest.Mock;
const mockGetFavorites = getFavorites as jest.MockedFunction<typeof getFavorites>;

const favorite = (id: string) =>
  ({
    favoriteId: `fav-${id}`,
    listingId: id,
    title: `Item ${id}`,
    priceCents: 1200,
    imageUrl: null,
    status: 'available',
  }) as any;

describe('FavoritesScreen (FIX-Task-29 item 1)', () => {
  let focusCallback: (() => void | (() => void)) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    focusCallback = undefined;
    mockUseFocusEffect.mockImplementation((cb: () => void | (() => void)) => {
      focusCallback = cb;
      // Mirror react-navigation's lifecycle: run the focus callback once per mount
      // (keyed on the stable callback) instead of on every render, which would loop.
      const React = require('react');
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [cb]);
    });
  });

  it('fetches favorites on mount and renders them', async () => {
    mockGetFavorites.mockResolvedValue({ success: true, data: [favorite('a')] } as any);

    const { findByText } = render(<FavoritesScreen />);

    expect(await findByText('Item a')).toBeTruthy();
    expect(mockGetFavorites).toHaveBeenCalledTimes(1);
    expect(focusCallback).toBeDefined();
  });

  it('refetches on re-focus, replacing a stale "No favorites yet" with the new favorite', async () => {
    // First focus (mount): nothing favourited yet — this is the stale snapshot.
    mockGetFavorites.mockResolvedValueOnce({ success: true, data: [] } as any);

    const { findByTestId, queryByTestId, findByText } = render(<FavoritesScreen />);

    expect(await findByTestId('favorites-empty')).toBeTruthy();

    // User goes to Discover, taps the heart, then returns → the screen focuses again.
    mockGetFavorites.mockResolvedValue({ success: true, data: [favorite('b')] } as any);
    await act(async () => {
      focusCallback?.();
    });

    expect(await findByText('Item b')).toBeTruthy();
    await waitFor(() => expect(queryByTestId('favorites-empty')).toBeNull());
    expect(mockGetFavorites).toHaveBeenCalledTimes(2);
  });
});
