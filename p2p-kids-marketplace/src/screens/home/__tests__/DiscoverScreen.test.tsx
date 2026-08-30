/**
 * File: p2p-kids-marketplace/src/screens/home/__tests__/DiscoverScreen.test.tsx
 * MODULE-05-DISCOVERY-V3: DiscoverScreen Unit Tests
 * Task: DISCOVERY-V3-005 - DiscoverScreen (Unified)
 *
 * Tests for the unified DiscoverScreen component
 */

import React from 'react';
import { Keyboard } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import DiscoverScreen from '../DiscoverScreen';
import { searchListings } from '@/services/discovery';
import {
  getRecentSearches,
  addSearchToHistory,
  clearSearchHistory,
  getAutocompleteSuggestions,
} from '@/services/searchHistory';
import { fetchDatabaseBrands } from '@/services/brandAutocomplete';
import { suggestSpellingCorrection } from '@/services/discovery';
import { getCategories } from '@/services/items';
import { useAuth, useSubscriptionStatus } from '@/hooks/useAuth';
import { checkZipCodeHasActiveNode } from '@/services/location';
import { upsertZipWaitlist, isUserOnWaitlist } from '@/services/waitlist';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => mockNavigation),
  useRoute: jest.fn(() => ({
    params: {},
  })),
  useFocusEffect: jest.fn((cb: () => void) => setImmediate(cb)),
}));

// Mock all services
jest.mock('@/services/discovery');
jest.mock('@/services/searchHistory');
jest.mock('@/services/brandAutocomplete');
jest.mock('@/services/items');
// 2026-08-22 (AUTH-TC-O03 regression): mock waitlist + location services so the
// inactive-ZIP consent flow is controllable per-test (no real enrollment, no
// network ZIP lookups).
jest.mock('@/services/location');
jest.mock('@/services/waitlist');
// Point the supabase client at the shared mock so tests can both drive the
// waitlist query (Fix A) and override per-table responses (__setSupabaseTableResponse).
jest.mock('@/config/supabase', () => require('@/__mocks__/supabase'));
// Group M Fix 4: mock the auth hook so the SP upgrade CTA gate (canSpendSP)
// is controllable per-test. Same auto-mock pattern as ItemCreateScreen tests.
jest.mock('@/hooks/useAuth');

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  setOptions: jest.fn(),
  canGoBack: jest.fn(() => true),
};

// Group M Fix 4: typed handles on the auto-mocked auth hook.
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseSubscriptionStatus = useSubscriptionStatus as jest.MockedFunction<
  typeof useSubscriptionStatus
>;

// Mock search results
const mockSearchResults = [
  {
    id: '1',
    title: 'Test Item 1',
    description: 'Description 1',
    price: 10.99,
    accepts_swap_points: true,
    status: 'available',
    seller_id: 'seller-1',
    category_id: 'cat-1',
    condition: 'good',
    age_group: '3-5',
    gender: 'unisex',
    brand: 'LEGO',
    color: ['red', 'blue'],
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    relevance: 0.9,
  },
  {
    id: '2',
    title: 'Test Item 2',
    description: 'Description 2',
    price: 20.5,
    accepts_swap_points: false,
    status: 'available',
    seller_id: 'seller-2',
    category_id: 'cat-2',
    condition: 'like_new',
    age_group: '6-8',
    gender: 'boy',
    brand: 'Nike',
    color: ['green'],
    created_at: '2026-04-21T00:00:00Z',
    updated_at: '2026-04-21T00:00:00Z',
    relevance: 0.7,
  },
];

describe('DiscoverScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Group M Fix 4: default to a logged-out "free" user (session null →
    // canSpendSP false), matching the real AuthContext default. Individual
    // tests override useSubscriptionStatus for the subscriber case.
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      isSignout: false,
      error: null,
      setSession: jest.fn(),
      refreshSession: jest.fn(),
      logout: jest.fn(),
      subscribeToSessionChanges: jest.fn(),
    } as any);
    mockUseSubscriptionStatus.mockReturnValue({
      status: 'free',
      canSpendSP: false,
      isTrialExpired: true,
    });

    // Setup default mock responses
    (searchListings as jest.Mock).mockResolvedValue(mockSearchResults);
    (getRecentSearches as jest.Mock).mockResolvedValue(['bike', 'toy', 'book']);
    (getCategories as jest.Mock).mockResolvedValue([
      { id: 'cat-1', name: 'Toys', icon: '🧸' },
      { id: 'cat-2', name: 'Books', icon: '📚' },
    ]);
    (fetchDatabaseBrands as jest.Mock).mockResolvedValue([]);
    (getAutocompleteSuggestions as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial Render', () => {
    it('renders the search input', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-search-input')).toBeTruthy();
      });
    });

    it('renders the filter button with active count', async () => {
      const { getByTestId, queryByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-filter-button')).toBeTruthy();
        // No active filters initially
        expect(queryByTestId('filter-badge')).toBeNull();
      });
    });

    it('renders SP-only quick toggle in discover controls', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-sp-toggle')).toBeTruthy();
      });
    });

    it('renders header favorites button and navigates to Favorites on press', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-header-favorites')).toBeTruthy();
      });

      fireEvent.press(getByTestId('discover-header-favorites'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Favorites');
    });

    it('loads recent searches on mount', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Focus search input to show recent searches
      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');

      await waitFor(() => {
        expect(getRecentSearches).toHaveBeenCalled();
      });
    });

    it('pre-warms brand cache on mount', async () => {
      render(<DiscoverScreen navigation={mockNavigation as any} route={{} as any} />);

      await waitFor(() => {
        expect(fetchDatabaseBrands).toHaveBeenCalled();
      });
    });

    it('performs initial search on mount', async () => {
      render(<DiscoverScreen navigation={mockNavigation as any} route={{} as any} />);

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });
    });
  });

  describe('Sort Dropdown', () => {
    it('opens sort dropdown and shows all 4 options', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-sort-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('discover-sort-button'));

      await waitFor(() => {
        expect(getByTestId('sort-dropdown-options')).toBeTruthy();
        expect(getByTestId('sort-option-relevance')).toBeTruthy();
        expect(getByTestId('sort-option-newest')).toBeTruthy();
        expect(getByTestId('sort-option-price_asc')).toBeTruthy();
        expect(getByTestId('sort-option-price_desc')).toBeTruthy();
      });
    });

    it('updates sort and re-runs search when a sort option is selected', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      const initialCalls = (searchListings as jest.Mock).mock.calls.length;

      fireEvent.press(getByTestId('discover-sort-button'));
      fireEvent.press(getByTestId('sort-option-price_desc'));

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls);
      });

      const calls = (searchListings as jest.Mock).mock.calls;
      expect(calls.some((call) => call[1]?.sortBy === 'price_desc')).toBe(true);
    });
  });

  describe('Quick SP Filter Toggle', () => {
    it('applies SP-only filter from discover header control', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      const initialCalls = (searchListings as jest.Mock).mock.calls.length;

      fireEvent.press(getByTestId('discover-sp-toggle'));

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCalls);
      });

      const calls = (searchListings as jest.Mock).mock.calls;
      expect(calls.some((call) => call[1]?.spEligibleOnly === true)).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    it('debounces search input with 200ms delay', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      const initialCallCount = (searchListings as jest.Mock).mock.calls.length;

      // Type query
      fireEvent.changeText(searchInput, 'bike');

      // Should not search immediately
      expect((searchListings as jest.Mock).mock.calls.length).toBe(initialCallCount);

      // Advance timers by 200ms
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Now should search
      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('adds search query to history after successful search', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');

      fireEvent.changeText(searchInput, 'bike');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(addSearchToHistory).toHaveBeenCalledWith('bike');
      });
    });

    it('displays search results after successful search', async () => {
      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');

      fireEvent.changeText(searchInput, 'test');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('Test Item 1')).toBeTruthy();
        expect(getByText('Test Item 2')).toBeTruthy();
      });
    });

    it('navigates to item detail when result is tapped', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        const result = getByTestId('search-result-1');
        fireEvent.press(result);
      });

      expect(mockNavigate).toHaveBeenCalledWith('ListingDetail', { listing_id: '1' });
    });
  });

  describe('Optimistic UI', () => {
    it('keeps previous results visible during new search', async () => {
      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Wait for initial results
      await waitFor(() => {
        expect(getByText('Test Item 1')).toBeTruthy();
      });

      // Start new search
      const searchInput = getByTestId('discover-search-input');
      const initialCallCount = (searchListings as jest.Mock).mock.calls.length;
      fireEvent.changeText(searchInput, 'new query');

      // Results should still be visible
      expect(getByText('Test Item 1')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Results will be replaced when new search completes
      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('does not show full-screen spinner after first load', async () => {
      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Wait for initial results
      await waitFor(() => {
        expect(getByText('Test Item 1')).toBeTruthy();
      });

      // Start new search
      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'new query');

      // Should not show full-screen loading (results still visible)
      expect(getByText('Test Item 1')).toBeTruthy();
    });
  });

  describe('Infinite Scroll', () => {
    it('loads more results when reaching end of list', async () => {
      const firstPageResults: SearchResult[] = Array.from({ length: 20 }, (_, index) => ({
        ...mockSearchResults[0],
        id: `${index + 1}`,
        title: `Test Item ${index + 1}`,
      }));

      (searchListings as jest.Mock).mockImplementation((_query: string, options: any) => {
        if ((options?.offset ?? 0) === 0) {
          return Promise.resolve(firstPageResults);
        }
        if (options?.offset === 20) {
          return Promise.resolve(mockSearchResults);
        }
        return Promise.resolve(mockSearchResults);
      });

      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      const initialCallCount = (searchListings as jest.Mock).mock.calls.length;

      // Trigger load more
      const resultsList = getByTestId('discover-results-list');
      act(() => {
        resultsList.props.onEndReached();
      });

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      // Check one of the new calls used offset=20 for next page
      const calls = (searchListings as jest.Mock).mock.calls;
      expect(calls.some((call) => call[1]?.offset === 20)).toBe(true);
    });

    it('shows loading more indicator when fetching next page', async () => {
      const firstPageResults: SearchResult[] = Array.from({ length: 20 }, (_, index) => ({
        ...mockSearchResults[0],
        id: `${index + 1}`,
        title: `Test Item ${index + 1}`,
      }));

      let resolveNextPage: ((value: SearchResult[]) => void) | undefined;
      const pendingNextPage = new Promise<SearchResult[]>((resolve) => {
        resolveNextPage = resolve;
      });

      (searchListings as jest.Mock).mockImplementation((_query: string, options: any) => {
        if ((options?.offset ?? 0) === 0) {
          return Promise.resolve(firstPageResults);
        }
        if (options?.offset === 20) {
          return pendingNextPage;
        }
        return Promise.resolve(mockSearchResults);
      });

      const { getByTestId, queryByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      // Trigger load more
      const resultsList = getByTestId('discover-results-list');
      act(() => {
        resultsList.props.onEndReached();
      });

      await waitFor(() => {
        const calls = (searchListings as jest.Mock).mock.calls;
        expect(calls.some((call) => call[1]?.offset === 20)).toBe(true);
      });

      await waitFor(() => {
        expect(queryByTestId('loading-more-indicator')).toBeTruthy();
      });

      await act(async () => {
        resolveNextPage?.(mockSearchResults);
      });
    });

    it('dedupes repeated page results when backend returns the same listings for next offset', async () => {
      const firstPageResults: SearchResult[] = Array.from({ length: 20 }, (_, index) => ({
        ...mockSearchResults[0],
        id: `${index + 1}`,
        title: `Test Item ${index + 1}`,
      }));

      (searchListings as jest.Mock).mockImplementation((_query: string, options: any) => {
        if ((options?.offset ?? 0) === 0) {
          return Promise.resolve(firstPageResults);
        }

        if (options?.offset === 20) {
          // Simulate backend bug where offset is ignored and page 1 is returned again.
          return Promise.resolve(firstPageResults);
        }

        return Promise.resolve([]);
      });

      const { getByTestId, queryAllByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      const initialCallCount = (searchListings as jest.Mock).mock.calls.length;

      const resultsList = getByTestId('discover-results-list');

      act(() => {
        resultsList.props.onEndReached();
      });

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      expect(queryAllByText('Test Item 1')).toHaveLength(1);

      act(() => {
        resultsList.props.onEndReached();
      });

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
          initialCallCount + 1
        );
      });
    });

    it('guards against duplicate fetch during load more', async () => {
      const firstPageResults: SearchResult[] = Array.from({ length: 20 }, (_, index) => ({
        ...mockSearchResults[0],
        id: `${index + 1}`,
        title: `Test Item ${index + 1}`,
      }));

      (searchListings as jest.Mock).mockImplementation((_query: string, options: any) => {
        if ((options?.offset ?? 0) === 0) {
          return Promise.resolve(firstPageResults);
        }
        if (options?.offset === 20) {
          return Promise.resolve(mockSearchResults);
        }
        return Promise.resolve(mockSearchResults);
      });

      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      const initialCallCount = (searchListings as jest.Mock).mock.calls.length;

      const resultsList = getByTestId('discover-results-list');

      // Trigger load more twice rapidly
      fireEvent(resultsList, 'endReached');
      fireEvent(resultsList, 'endReached');

      await waitFor(() => {
        // Should only call once more (not twice)
        expect((searchListings as jest.Mock).mock.calls.length).toBe(initialCallCount + 1);
      });
    });
  });

  describe('Recent Searches', () => {
    it('shows recent searches when input is focused and empty', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');

      await waitFor(() => {
        expect(getByTestId('recent-searches-panel')).toBeTruthy();
      });
    });

    it('hides recent searches when typing', async () => {
      const { getByTestId, queryByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');

      await waitFor(() => {
        expect(getByTestId('recent-searches-panel')).toBeTruthy();
      });

      fireEvent.changeText(searchInput, 'bi');

      expect(queryByTestId('recent-searches-panel')).toBeNull();
    });

    // DISCOVER-REDESIGN: per-item ✕ was deliberately removed — recent searches are
    // now tappable chips with a single "Clear" action (see "allows clearing all
    // recent searches" below). Tapping a chip re-runs that search.
    it('runs search when a recent search chip is tapped', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');

      await waitFor(() => {
        expect(getByTestId('recent-search-0')).toBeTruthy();
      });

      fireEvent.press(getByTestId('recent-search-0'));

      await waitFor(() => {
        expect(searchInput.props.value).toBe('bike');
      });
    });

    it('allows clearing all recent searches', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');

      await waitFor(() => {
        expect(getByTestId('recent-searches-panel')).toBeTruthy();
      });

      const clearButton = getByTestId('clear-recent-searches');
      fireEvent.press(clearButton);

      await waitFor(() => {
        expect(clearSearchHistory).toHaveBeenCalled();
      });
    });
  });

  describe('Autocomplete', () => {
    it('shows autocomplete suggestions when typing (>= 2 chars)', async () => {
      (getAutocompleteSuggestions as jest.Mock).mockReturnValue(['bike', 'bicycle']);

      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');
      fireEvent.changeText(searchInput, 'bi');

      await waitFor(() => {
        expect(getByTestId('autocomplete-panel')).toBeTruthy();
      });
    });

    it('shows dictionary-based suggestions when history has no matches', async () => {
      (getAutocompleteSuggestions as jest.Mock).mockReturnValue([]);

      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');
      fireEvent.changeText(searchInput, 'bi');

      await waitFor(() => {
        expect(getByTestId('autocomplete-panel')).toBeTruthy();
      });

      await waitFor(() => {
        // Dictionary is populated from recent searches ('bike', 'toy', 'book')
        expect(getByText('bike')).toBeTruthy();
      });
    });

    it('does not show autocomplete for single character', async () => {
      const { getByTestId, queryByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');
      fireEvent.changeText(searchInput, 'b');

      await waitFor(() => {
        expect(queryByTestId('autocomplete-panel')).toBeNull();
      });
    });

    it('fills search input when autocomplete suggestion is tapped', async () => {
      (getAutocompleteSuggestions as jest.Mock).mockReturnValue(['bike']);

      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');
      fireEvent.changeText(searchInput, 'bi');

      await waitFor(() => {
        expect(getByTestId('autocomplete-panel')).toBeTruthy();
      });

      const suggestion = getByTestId('autocomplete-suggestion-0');
      fireEvent.press(suggestion);

      expect(searchInput.props.value).toBe('bike');
    });
  });

  describe('Empty States', () => {
    it('shows initial empty state when no search performed', async () => {
      (searchListings as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByText('Discover Items')).toBeTruthy();
        expect(getByText('Search or browse to find items near you')).toBeTruthy();
      });
    });

    it('shows "no results" when search returns empty', async () => {
      (searchListings as jest.Mock).mockResolvedValue([]);

      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'nonexistent');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('No Results Found')).toBeTruthy();
      });
    });

    it('suggests spelling correction when no results', async () => {
      (searchListings as jest.Mock).mockResolvedValue([]);
      (suggestSpellingCorrection as jest.Mock).mockReturnValue('bicycle');

      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'bycicle');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByText('Did you mean "bicycle"?')).toBeTruthy();
      });
    });

    // Group M P2: when results are empty AND filters are active, the "Clear
    // Filters" action can be pushed below the software keyboard and become
    // unreachable. The screen must dismiss the keyboard so the action is always
    // reachable.
    it('dismisses the keyboard when the empty "Clear Filters" state renders', async () => {
      const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      (searchListings as jest.Mock).mockResolvedValue([]);

      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Apply an active filter (SP toggle) so the "Clear Filters" variant shows.
      await waitFor(() => {
        expect(getByTestId('discover-sp-toggle')).toBeTruthy();
      });
      fireEvent.press(getByTestId('discover-sp-toggle'));

      await waitFor(() => {
        expect(getByTestId('clear-filters-button')).toBeTruthy();
      });

      expect(dismissSpy).toHaveBeenCalled();
      dismissSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('shows network error banner when search fails', async () => {
      (searchListings as jest.Mock)
        .mockResolvedValueOnce(mockSearchResults)
        .mockRejectedValueOnce(new Error('Network error'));

      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'test');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByTestId('network-error-banner')).toBeTruthy();
      });
    });

    it('retries search when error banner is tapped', async () => {
      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Wait for the mount searches to finish successfully first.
      await waitFor(() => {
        expect(getByText('Test Item 1')).toBeTruthy();
      });

      // Fail every search from here on (persistent), so the error banner stays
      // visible instead of being cleared by a later resolved search.
      (searchListings as jest.Mock).mockRejectedValue(new Error('Network error'));

      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'test');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByTestId('network-error-banner')).toBeTruthy();
      });

      const errorBanner = getByTestId('network-error-banner');
      const callCountBeforeRetry = (searchListings as jest.Mock).mock.calls.length;
      fireEvent.press(errorBanner);

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBe(callCountBeforeRetry + 1);
      });
    });

    it('does not clear existing results when search fails', async () => {
      const { getByTestId, getByText } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Wait for initial successful results
      await waitFor(() => {
        expect(getByText('Test Item 1')).toBeTruthy();
      });

      // Trigger a failing search
      (searchListings as jest.Mock).mockRejectedValue(new Error('Network error'));

      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'fail');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(getByTestId('network-error-banner')).toBeTruthy();
      });

      // Previous results should still be visible
      expect(getByText('Test Item 1')).toBeTruthy();
    });
  });

  describe('Pull to Refresh', () => {
    it('resets offset and refreshes results', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(searchListings).toHaveBeenCalled();
      });

      const initialCallCount = (searchListings as jest.Mock).mock.calls.length;

      const resultsList = getByTestId('discover-results-list');
      act(() => {
        resultsList.props.refreshControl.props.onRefresh();
      });

      await waitFor(() => {
        expect((searchListings as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      // Check offset was reset to 0
      const calls = (searchListings as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1].offset).toBe(0);
    });
  });

  // Group M P3 / BP-53: Discover-surface controls must surface as distinct
  // accessibility-tree elements (accessible + accessibilityRole) — QA testID
  // automation and screen readers rely on these being real AX elements, not
  // just visual Pressables. (Trending chips render only for a signed-in
  // userState and are verified on-device via AX-tree inspection instead.)
  describe('Accessibility (Group M P3 / BP-53)', () => {
    it('exposes filter + SP toggle + search clear as accessible buttons', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-filter-button')).toBeTruthy();
        expect(getByTestId('discover-sp-toggle')).toBeTruthy();
      });

      const filterBtn = getByTestId('discover-filter-button');
      expect(filterBtn.props.accessible).toBe(true);
      expect(filterBtn.props.accessibilityRole).toBe('button');

      const spToggle = getByTestId('discover-sp-toggle');
      expect(spToggle.props.accessible).toBe(true);
      expect(spToggle.props.accessibilityRole).toBe('button');

      // Search clear-X only appears while there is text in the query.
      const searchInput = getByTestId('discover-search-input');
      fireEvent.changeText(searchInput, 'bi');

      await waitFor(() => {
        expect(getByTestId('discover-search-clear')).toBeTruthy();
      });

      const clearX = getByTestId('discover-search-clear');
      expect(clearX.props.accessible).toBe(true);
      expect(clearX.props.accessibilityRole).toBe('button');
      expect(clearX.props.accessibilityLabel).toBe('Clear search');
    });

    it('exposes recent-search chips and autocomplete suggestions as accessible buttons', async () => {
      (getAutocompleteSuggestions as jest.Mock).mockReturnValue(['bike']);
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');

      // Recent searches show when the input is focused (empty) — chips must be buttons.
      fireEvent(searchInput, 'focus');
      await waitFor(() => {
        expect(getByTestId('recent-search-0')).toBeTruthy();
      });

      const recentChip = getByTestId('recent-search-0');
      expect(recentChip.props.accessible).toBe(true);
      expect(recentChip.props.accessibilityRole).toBe('button');

      // Autocomplete suggestions show when typing — must be buttons.
      fireEvent.changeText(searchInput, 'bi');
      await waitFor(() => {
        expect(getByTestId('autocomplete-suggestion-0')).toBeTruthy();
      });

      const suggestion = getByTestId('autocomplete-suggestion-0');
      expect(suggestion.props.accessible).toBe(true);
      expect(suggestion.props.accessibilityRole).toBe('button');
      expect(suggestion.props.accessibilityLabel).toBe('Search for bike');
    });

    it('exposes active-filter-chip controls as accessible buttons', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      // Apply the SP filter so an active chip + "Clear all" render above the grid.
      await waitFor(() => {
        expect(getByTestId('discover-sp-toggle')).toBeTruthy();
      });
      fireEvent.press(getByTestId('discover-sp-toggle'));

      await waitFor(() => {
        expect(getByTestId('clear-all-filters')).toBeTruthy();
      });

      const clearAll = getByTestId('clear-all-filters');
      expect(clearAll.props.accessible).toBe(true);
      expect(clearAll.props.accessibilityRole).toBe('button');

      const removeChip = getByTestId('remove-filter-spEligibleOnly');
      expect(removeChip.props.accessible).toBe(true);
      expect(removeChip.props.accessibilityRole).toBe('button');
    });
  });

  // Group M Fix 4: Free-user upgrade CTA for the "Accepts SP" filter.
  // Free users who toggle/filter by SP (header quick-toggle or Filters sheet)
  // or view SP-eligible results get a Kids Club+ upgrade CTA that opens
  // Subscription Choice; subscribers never see it (AUTH-TC-J07 pattern).
  describe('SP Upgrade CTA (Group M Fix 4)', () => {
    it('shows the Kids Club+ upgrade CTA for a free user when the SP filter is active and opens Subscription Choice', async () => {
      const { getByTestId, queryByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-sp-toggle')).toBeTruthy();
      });

      // CTA hidden before the SP filter is applied.
      expect(queryByTestId('discover-sp-upgrade-cta')).toBeNull();

      // Free user toggles the header quick-toggle → CTA appears immediately.
      fireEvent.press(getByTestId('discover-sp-toggle'));

      await waitFor(() => {
        expect(getByTestId('discover-sp-upgrade-cta')).toBeTruthy();
      });

      // "Upgrade Now" opens Subscription Choice (JoinKidsClub).
      fireEvent.press(getByTestId('discover-sp-upgrade-button'));
      expect(mockNavigate).toHaveBeenCalledWith('JoinKidsClub');

      // Turning the SP filter back off hides the CTA.
      fireEvent.press(getByTestId('discover-sp-toggle'));
      await waitFor(() => {
        expect(queryByTestId('discover-sp-upgrade-cta')).toBeNull();
      });
    });

    it('does NOT show the upgrade CTA for a subscriber even when the SP filter is active', async () => {
      mockUseSubscriptionStatus.mockReturnValue({
        status: 'active',
        canSpendSP: true,
        isTrialExpired: false,
      });

      const { getByTestId, queryByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-sp-toggle')).toBeTruthy();
      });

      fireEvent.press(getByTestId('discover-sp-toggle'));

      // Confirm the SP filter actually became active for the subscriber (so the
      // missing CTA is due to the subscription gate, not an inactive filter).
      await waitFor(() => {
        const calls = (searchListings as jest.Mock).mock.calls;
        expect(calls.some((call) => call[1]?.spEligibleOnly === true)).toBe(true);
      });

      expect(queryByTestId('discover-sp-upgrade-cta')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// ZIP waitlist consent + scope decouple (2026-08-22) — AUTH-TC-O03 regression
// ---------------------------------------------------------------------------
// The shared Supabase mock (jest.setup.ts) exposes mock-only helpers that are
// NOT on the real `@/config/supabase` export type, so we require() it here.
const supabaseMock = require('@/config/supabase') as {
  supabase: any;
  __setSupabaseTableResponse: (
    table: string,
    operation: string,
    response: { data: any; error: any }
  ) => void;
};

describe('DiscoverScreen ZIP waitlist opt-in + scope (2026-08-22)', () => {
  const userId = '49243010-f458-4744-add1-a6c84ab95f1f';
  const userEmail = 'test-buyer@kidsmarketplace.test';
  const userNodeId = '550e8400-e29b-41d4-a716-446655440001';
  const homeZip = '06850';

  const signedInSession = {
    user: {
      id: userId,
      user_id: userId,
      email: userEmail,
      name: 'Test Buyer',
      zip_code: homeZip,
      node_id: userNodeId,
      node: { id: userNodeId, state: 'CT' },
    },
  } as any;

  const renderSignedIn = () =>
    render(<DiscoverScreen navigation={mockNavigation as any} route={{} as any} />);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseAuth.mockReturnValue({
      session: signedInSession,
      user: signedInSession.user,
      isLoading: false,
      isSignout: false,
      error: null,
      setSession: jest.fn(),
      refreshSession: jest.fn(),
      logout: jest.fn(),
      subscribeToSessionChanges: jest.fn(),
    } as any);
    (checkZipCodeHasActiveNode as jest.Mock).mockResolvedValue(false);
    (isUserOnWaitlist as jest.Mock).mockResolvedValue(false);
    (upsertZipWaitlist as jest.Mock).mockResolvedValue({
      success: true,
      wasNewEntry: true,
      requestedZip: '99999',
      assignedNodeId: null,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does NOT create a zip_waitlist row when an inactive ZIP is applied; No leaves no row', async () => {
    const screen = renderSignedIn();

    await waitFor(() => {
      expect(screen.getByTestId('discover-filter-button')).toBeTruthy();
    });

    // Open the filter sheet, enter an inactive ZIP, apply.
    fireEvent.press(screen.getByTestId('discover-filter-button'));
    fireEvent.changeText(screen.getByTestId('filter-location-zip-input'), '99999');
    fireEvent.press(screen.getByTestId('filter-modal-apply'));

    // Applying an inactive ZIP must NOT auto-enroll. The consent step appears
    // (async apply + 300ms modal-close delay).
    await waitFor(() => {
      expect(screen.getByTestId('inactive-zip-waitlist-yes')).toBeTruthy();
    });
    expect(upsertZipWaitlist).not.toHaveBeenCalled();

    // Explicit "No" → still no row; outcome step with navigation appears.
    fireEvent.press(screen.getByTestId('inactive-zip-waitlist-no'));
    expect(upsertZipWaitlist).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('inactive-zip-see-all-results')).toBeTruthy();
    });
    expect(screen.queryByTestId('inactive-zip-waitlist-yes')).toBeNull();
  });

  it('creates the zip_waitlist row only after explicit Yes consent', async () => {
    const screen = renderSignedIn();

    await waitFor(() => {
      expect(screen.getByTestId('discover-filter-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('discover-filter-button'));
    fireEvent.changeText(screen.getByTestId('filter-location-zip-input'), '99999');
    fireEvent.press(screen.getByTestId('filter-modal-apply'));

    await waitFor(() => {
      expect(screen.getByTestId('inactive-zip-waitlist-yes')).toBeTruthy();
    });
    expect(upsertZipWaitlist).not.toHaveBeenCalled();

    // Explicit "Yes" → the row is created with the user's identity + ZIP.
    fireEvent.press(screen.getByTestId('inactive-zip-waitlist-yes'));
    await waitFor(() => {
      expect(upsertZipWaitlist).toHaveBeenCalledWith({
        userId,
        email: userEmail,
        requestedZip: '99999',
      });
    });

    // Outcome step confirms enrollment with the navigation options.
    await waitFor(() => {
      expect(screen.getByTestId('inactive-zip-see-all-results')).toBeTruthy();
    });
  });

  it('skips the consent step when the user is already on the waitlist for that ZIP', async () => {
    (isUserOnWaitlist as jest.Mock).mockResolvedValue(true);
    const screen = renderSignedIn();

    await waitFor(() => {
      expect(screen.getByTestId('discover-filter-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('discover-filter-button'));
    fireEvent.changeText(screen.getByTestId('filter-location-zip-input'), '99999');
    fireEvent.press(screen.getByTestId('filter-modal-apply'));

    // No consent step — straight to the "already on the list" outcome.
    await waitFor(() => {
      expect(screen.getByTestId('inactive-zip-see-all-results')).toBeTruthy();
    });
    expect(screen.queryByTestId('inactive-zip-waitlist-yes')).toBeNull();
    expect(upsertZipWaitlist).not.toHaveBeenCalled();
  });

  it("scopes the waitlist check to the user's own home ZIP — a filter-path row for another ZIP cannot flip their scope", async () => {
    const screen = renderSignedIn();

    // No home-ZIP row → NOT waitlisted → node-scoped default (toggle visible).
    await waitFor(() => {
      expect(screen.getByTestId('discover-show-all-nodes-toggle')).toBeTruthy();
    });

    // The waitlist query is now scoped to the user's own home ZIP + active
    // statuses — a row for a *different* ZIP (e.g. filter exploration) can't
    // match and flip the default scope to global-browse.
    const fromCalls = supabaseMock.supabase.from.mock.calls;
    const idx = fromCalls.findIndex((c: string[]) => c[0] === 'zip_waitlist');
    expect(idx).toBeGreaterThanOrEqual(0);
    const builder = supabaseMock.supabase.from.mock.results[idx].value;
    expect(builder.eq).toHaveBeenCalledWith('user_id', userId);
    expect(builder.eq).toHaveBeenCalledWith('requested_zip', homeZip);
    expect(builder.in).toHaveBeenCalledWith('status', ['pending', 'notified']);

    // Search actually ran node-scoped for the user's node.
    const calls = (searchListings as jest.Mock).mock.calls;
    expect(
      calls.some((call) => JSON.stringify(call[1]?.nodeIds) === JSON.stringify([userNodeId]))
    ).toBe(true);
  });

  it("keeps the global-browse fallback when the waitlist row IS for the user's own home ZIP", async () => {
    // Simulate an onboarding waitlist row for the user's home ZIP.
    supabaseMock.__setSupabaseTableResponse('zip_waitlist', 'select', {
      data: [{ id: 'wl-home-row' }],
      error: null,
    });

    const screen = renderSignedIn();

    // Waitlisted → global-browse fallback: Show All Nodes toggle hidden.
    await waitFor(() => {
      expect(screen.queryByTestId('discover-show-all-nodes-toggle')).toBeNull();
    });

    // Search ran global (no nodeIds).
    const calls = (searchListings as jest.Mock).mock.calls;
    expect(calls.some((call) => call[1]?.nodeIds === undefined)).toBe(true);
  });
});
