/**
 * File: p2p-kids-marketplace/src/screens/home/__tests__/DiscoverScreen.test.tsx
 * MODULE-05-DISCOVERY-V3: DiscoverScreen Unit Tests
 * Task: DISCOVERY-V3-005 - DiscoverScreen (Unified)
 *
 * Tests for the unified DiscoverScreen component
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import DiscoverScreen from '../DiscoverScreen';
import { searchListings } from '@/services/discovery';
import {
  getRecentSearches,
  addSearchToHistory,
  removeSearchFromHistory,
  clearSearchHistory,
  getAutocompleteSuggestions,
} from '@/services/searchHistory';
import { fetchDatabaseBrands } from '@/services/brandAutocomplete';
import { suggestSpellingCorrection } from '@/services/discovery';
import { getCategories } from '@/services/items';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
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

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  setOptions: jest.fn(),
  canGoBack: jest.fn(() => true),
};

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

    it('renders favorites heart button and navigates to Favorites on press', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      await waitFor(() => {
        expect(getByTestId('discover-favorites-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('discover-favorites-button'));
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

    it('allows removing a recent search', async () => {
      const { getByTestId } = render(
        <DiscoverScreen navigation={mockNavigation as any} route={{} as any} />
      );

      const searchInput = getByTestId('discover-search-input');
      fireEvent(searchInput, 'focus');

      await waitFor(() => {
        expect(getByTestId('recent-searches-panel')).toBeTruthy();
      });

      const removeButton = getByTestId('remove-recent-search-0');
      fireEvent.press(removeButton);

      await waitFor(() => {
        expect(removeSearchFromHistory).toHaveBeenCalledWith('bike');
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
});
