/**
 * File: p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx
 * MODULE-05-DISCOVERY-V3: Unified Discover Screen
 * Task: DISCOVERY-V3-005 - DiscoverScreen (Unified)
 *
 * Replaces SearchScreen and BrowseItemsScreen with a single unified discovery experience
 * Features: debounced search, 9 filters, 4 sort options, infinite scroll, optimistic UI
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
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
import { countActiveFilters, getDefaultFilters } from '@/utils/filterHelpers';
import { SearchResult, DiscoveryFilters, SortOption } from '@/types/discovery';
import { getCategories } from '@/services/items';
import { ListingImage, SortDropdown } from '@/components/atoms';
import { SearchFilterModal } from '@/components/molecules';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import { Ionicons } from '@expo/vector-icons';

// Search debounce constants: 200ms for active typing, 0ms for filter/sort changes
const KEYSTROKE_DEBOUNCE_MS = 200;
const FILTER_DEBOUNCE_MS = 0;

// Pagination batch size
const RESULTS_PER_PAGE = 20;
const AUTOCOMPLETE_MAX = 5;

// Props type
type Props = NativeStackScreenProps<any, 'Discover'>;

/**
 * DiscoverScreen Component
 *
 * Unified discovery experience with:
 * - 600ms debounced keystroke search (for better typing UX)
 * - 0ms debounce for 9-dimensional filtering (immediate feedback)
 * - 4 sort options
 * - Infinite scroll pagination
 * - Optimistic UI (previous results stay visible during fetch)
 * - Recent searches and autocomplete
 * - Network error handling (non-blocking)
 */
export default function DiscoverScreen({ navigation }: Props) {
  // --- STATE ---

  // Search query (controlled input)
  const [query, setQuery] = useState('');

  // Suggestions for spell correction (V3: pulled from categories & brands)
  const [dictionary, setDictionary] = useState<string[]>([]);

  // Debounced query (drives actual fetch)
  // Using 600ms for keystrokes to prevent triggering while user is typing
  const debouncedQuery = useDebouncedValue(query, KEYSTROKE_DEBOUNCE_MS);

  // Filters and sort
  const [filters, setFilters] = useState<DiscoveryFilters>(getDefaultFilters());
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  // Debounced filters/sort (using 0ms for immediate feedback on filter clicks)
  const debouncedFilters = useDebouncedValue(filters, FILTER_DEBOUNCE_MS);
  const debouncedSortBy = useDebouncedValue(sortBy, FILTER_DEBOUNCE_MS);

  // Results and loading states
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false); // First load or filter change
  const [loadingMore, setLoadingMore] = useState(false); // Infinite scroll batch
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Categories for filter modal
  const [categories, setCategories] = useState<any[]>([]);

  // Offset for pagination
  const [offset, setOffset] = useState(0);

  // --- COMPUTED VALUES ---

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  // --- LIFECYCLE ---

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Pre-warm brand cache on mount
  useEffect(() => {
    fetchDatabaseBrands().catch((err) => {
      console.warn('[DiscoverScreen] Failed to pre-warm brand cache:', err);
    });
  }, []);

  // Perform search when debouncedQuery, debouncedFilters or debouncedSortBy change
  useEffect(() => {
    performSearch({ resetOffset: true });
  }, [debouncedQuery, debouncedFilters, debouncedSortBy]);

  // Load recent searches on mount and when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
    }, [])
  );

  // Update autocomplete suggestions when query changes
  useEffect(() => {
    const updateAutocomplete = async () => {
      if (query.trim().length >= 2) {
        const normalizedQuery = query.trim().toLowerCase();

        // Source 1: user-specific history
        const historySuggestions = await getAutocompleteSuggestions(query, AUTOCOMPLETE_MAX);

        // Source 2: shared dictionary (categories/common words + learned history)
        const startsWithMatches = dictionary.filter((word) =>
          word.trim().toLowerCase().startsWith(normalizedQuery)
        );
        const containsMatches = dictionary.filter((word) => {
          const normalizedWord = word.trim().toLowerCase();
          return (
            normalizedWord.includes(normalizedQuery) && !normalizedWord.startsWith(normalizedQuery)
          );
        });
        const dictionarySuggestions = [...startsWithMatches, ...containsMatches];

        // Merge, de-duplicate (case-insensitive), and keep max 5.
        const mergedSuggestions: string[] = [];
        const seen = new Set<string>();

        for (const suggestion of [...historySuggestions, ...dictionarySuggestions]) {
          const cleaned = suggestion.trim();
          if (!cleaned) {
            continue;
          }

          const normalized = cleaned.toLowerCase();
          if (seen.has(normalized)) {
            continue;
          }

          seen.add(normalized);
          mergedSuggestions.push(cleaned);

          if (mergedSuggestions.length >= AUTOCOMPLETE_MAX) {
            break;
          }
        }

        setAutocompleteSuggestions(mergedSuggestions);
        setAutocompleteVisible(mergedSuggestions.length > 0);
      } else {
        setAutocompleteSuggestions([]);
        setAutocompleteVisible(false);
      }
    };

    updateAutocomplete();
  }, [query, dictionary]);

  // --- FUNCTIONS ---

  /**
   * Load initial data (categories, recent searches, dictionary)
   */
  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load categories for filter modal AND dictionary
      const categoriesData = await getCategories();
      setCategories(categoriesData || []);

      // Build dictionary for spell correction (categories + common items)
      const categoryNames = (categoriesData || []).map((c: any) => c.name);

      // Load recent searches
      const searches = await getRecentSearches();
      setRecentSearches(searches);

      // Combined dictionary: Categories + Recent Searches + Hardcoded defaults
      const commonWords = ['Bicycle', 'Tricycle', 'Scooter', 'Stroller', 'Monitor'];
      const combinedDict = Array.from(new Set([...categoryNames, ...searches, ...commonWords]));
      setDictionary(combinedDict);
    } catch (err) {
      console.error('[DiscoverScreen] Failed to load initial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load recent searches from AsyncStorage
   */
  const loadRecentSearches = async () => {
    try {
      const searches = await getRecentSearches();
      setRecentSearches(searches);

      // Keep dictionary updated with any new searches
      setDictionary((prev) => Array.from(new Set([...prev, ...searches])));
    } catch (err) {
      console.warn('[DiscoverScreen] Failed to load recent searches:', err);
    }
  };

  /**
   * Perform search with current query and filters
   * Optimistic UI: previous results stay visible until new ones arrive
   */
  const performSearch = useCallback(
    async ({
      resetOffset = false,
      forcedOffset,
    }: {
      resetOffset?: boolean;
      forcedOffset?: number;
    } = {}) => {
      try {
        const newOffset =
          typeof forcedOffset === 'number' ? forcedOffset : resetOffset ? 0 : offset;

        // For first page or filter change, show main loading indicator
        // For infinite scroll, show loadingMore indicator
        if (resetOffset || newOffset === 0) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        // Build filters with current query
        const searchFilters: DiscoveryFilters = {
          ...filters,
          query: debouncedQuery.trim() || undefined,
          sortBy,
          limit: RESULTS_PER_PAGE,
          offset: newOffset,
        };

        const searchResults = await searchListings(debouncedQuery.trim(), searchFilters);

        // Optimistic UI: append results for infinite scroll, replace for new search
        if (resetOffset || newOffset === 0) {
          setResults(searchResults);
          setOffset(0);
        } else {
          setResults((prev) => [...prev, ...searchResults]);
          setOffset(newOffset);
        }

        // Update hasMore flag
        setHasMore(searchResults.length === RESULTS_PER_PAGE);

        // Add to search history if query is non-empty
        if (debouncedQuery.trim().length > 0) {
          await addSearchToHistory(debouncedQuery.trim());
          await loadRecentSearches();
        }
      } catch (err) {
        console.error('[DiscoverScreen] Search failed:', err);
        setError(err instanceof Error ? err.message : 'Search failed');

        // On error, do NOT clear existing results (non-blocking error)
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, filters, sortBy, offset]
  );

  /**
   * Handle reaching end of list (infinite scroll)
   */
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) {
      return; // Guard against duplicate fetches
    }

    const newOffset = offset + RESULTS_PER_PAGE;
    performSearch({ resetOffset: false, forcedOffset: newOffset });
  }, [loadingMore, hasMore, loading, offset, performSearch]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    setOffset(0);
    performSearch({ resetOffset: true });
  }, [performSearch]);

  /**
   * Handle search input change
   */
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  /**
   * Handle search input focus
   */
  const handleSearchFocus = () => {
    setSearchFocused(true);
  };

  /**
   * Handle search input blur
   */
  const handleSearchBlur = () => {
    setSearchFocused(false);
    // Close autocomplete after a short delay to allow tap on suggestion
    setTimeout(() => setAutocompleteVisible(false), 200);
  };

  /**
   * Handle tapping an autocomplete suggestion
   */
  const handleAutocompleteTap = (suggestion: string) => {
    setQuery(suggestion);
    setAutocompleteVisible(false);
    // Search will be triggered by debouncedQuery effect
  };

  /**
   * Handle removing a recent search
   */
  const handleRemoveRecentSearch = async (search: string) => {
    try {
      await removeSearchFromHistory(search);
      await loadRecentSearches();
    } catch (err) {
      console.warn('[DiscoverScreen] Failed to remove search:', err);
    }
  };

  /**
   * Handle clearing all recent searches
   */
  const handleClearAllRecentSearches = async () => {
    try {
      await clearSearchHistory();
      await loadRecentSearches();
    } catch (err) {
      console.warn('[DiscoverScreen] Failed to clear searches:', err);
    }
  };

  /**
   * Handle opening filter modal
   */
  const handleOpenFilters = () => {
    setFilterModalVisible(true);
  };

  /**
   * Handle applying filters from modal
   */
  const handleApplyFilters = (newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
    setFilterModalVisible(false);
    setOffset(0);
  };

  /**
   * Handle closing filter modal without applying
   */
  const handleCloseFilters = () => {
    setFilterModalVisible(false);
  };

  /**
   * Handle sort option change
   */
  const handleSortChange = (nextSortBy: SortOption) => {
    setSortBy(nextSortBy);
    setOffset(0);
  };

  /**
   * Handle tapping a result card
   */
  const handleResultPress = (itemId: string) => {
    navigation.navigate('ListingDetail', { listing_id: itemId });
  };

  /**
   * Handle retry after network error
   */
  const handleRetry = () => {
    performSearch({ resetOffset: true });
  };

  // --- RENDER HELPERS ---

  /**
   * Render a single search result card
   */
  const renderResult = useCallback(({ item }: { item: SearchResult }) => {
    const mainImageUrl = item.images && item.images.length > 0 ? item.images[0].url : null;

    return (
      <Pressable
        testID={`search-result-${item.id}`}
        accessibilityLabel={`${item.title}, $${item.price}`}
        style={styles.resultCard}
        onPress={() => handleResultPress(item.id)}
      >
        <ListingImage
          url={mainImageUrl}
          containerStyle={styles.resultImage}
          imageStyle={styles.resultImage}
        />
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.resultPrice}>${item.price.toFixed(2)}</Text>
            {item.accepts_swap_points && <Text style={styles.spBadge}>SP ✓</Text>}
          </View>
        </View>
      </Pressable>
    );
  }, []);

  /**
   * Render list header (search input, filters, sort)
   */
  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </Pressable>
          )}
          {/* Search Input Container - Prevents re-mount of input */}
          <View style={[styles.searchContainer, navigation.canGoBack() && { marginLeft: 8 }]}>
            <TextInput
              testID="discover-search-input"
              accessibilityLabel="Search for items"
              style={styles.searchInput}
              placeholder="Search for items..."
              value={query}
              onChangeText={handleQueryChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Filter and Sort Row */}
        <View style={styles.controlsRow}>
          <Pressable
            testID="discover-filter-button"
            accessibilityLabel={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
            style={styles.filterButton}
            onPress={handleOpenFilters}
          >
            <Text style={styles.filterButtonText}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge} testID="filter-badge">
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>

          <SortDropdown value={sortBy} onChange={handleSortChange} />
        </View>

        {/* Network Error Banner */}
        {error && (
          <Pressable testID="network-error-banner" style={styles.errorBanner} onPress={handleRetry}>
            <Text style={styles.errorBannerText}>⚠️ {error}. Tap to retry.</Text>
          </Pressable>
        )}

        {/* Autocomplete Panel */}
        {autocompleteVisible && searchFocused && autocompleteSuggestions.length > 0 && (
          <View style={styles.autocompletePanel} testID="autocomplete-panel">
            {autocompleteSuggestions.map((suggestion, index) => (
              <Pressable
                key={`autocomplete-${index}`}
                testID={`autocomplete-suggestion-${index}`}
                style={styles.autocompleteSuggestion}
                onPress={() => handleAutocompleteTap(suggestion)}
              >
                <Text style={styles.autocompleteSuggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Recent Searches Panel (shown when focused and query is empty) */}
        {searchFocused && query.trim().length === 0 && recentSearches.length > 0 && (
          <View style={styles.recentSearchesPanel} testID="recent-searches-panel">
            <View style={styles.recentSearchesHeader}>
              <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
              <Pressable testID="clear-recent-searches" onPress={handleClearAllRecentSearches}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </Pressable>
            </View>
            {recentSearches.map((search, index) => (
              <View key={`recent-${index}`} style={styles.recentSearchRow}>
                <Pressable
                  testID={`recent-search-${index}`}
                  style={styles.recentSearchButton}
                  onPress={() => handleAutocompleteTap(search)}
                >
                  <Text style={styles.recentSearchText}>{search}</Text>
                </Pressable>
                <Pressable
                  testID={`remove-recent-search-${index}`}
                  style={styles.removeRecentButton}
                  onPress={() => handleRemoveRecentSearch(search)}
                >
                  <Text style={styles.removeRecentText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  /**
   * Render list footer (loading more indicator)
   */
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingMore} testID="loading-more-indicator">
        <ActivityIndicator color="#007AFF" />
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmpty = () => {
    if (loading) return null;

    // Suggest spelling correction if no results and no active filters
    // V3: Use enriched dictionary instead of just recentSearches
    const spellSuggestion =
      results.length === 0 && activeFilterCount === 0 && debouncedQuery.trim().length > 0
        ? suggestSpellingCorrection(debouncedQuery.trim(), dictionary)
        : null;

    return (
      <View style={styles.emptyContainer} testID="empty-state">
        {activeFilterCount > 0 ? (
          <>
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
            <Pressable
              testID="clear-filters-button"
              style={styles.clearFiltersButton}
              onPress={() => setFilters(getDefaultFilters())}
            >
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </Pressable>
          </>
        ) : spellSuggestion ? (
          <>
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptySubtitle}>Did you mean "{spellSuggestion}"?</Text>
            <Pressable
              testID="spell-suggestion-button"
              style={styles.spellSuggestionButton}
              onPress={() => setQuery(spellSuggestion)}
            >
              <Text style={styles.spellSuggestionText}>Search for "{spellSuggestion}"</Text>
            </Pressable>
          </>
        ) : debouncedQuery.trim().length > 0 ? (
          <>
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptySubtitle}>Try different keywords</Text>
          </>
        ) : (
          <>
            <Text style={styles.emptyTitle}>Discover Items</Text>
            <Text style={styles.emptySubtitle}>Search or browse to find items near you</Text>
          </>
        )}
      </View>
    );
  };

  // --- MAIN RENDER ---

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Input - Static at the top to prevent losing focus on re-renders */}
      {renderHeader()}

      <FlatList
        testID="discover-results-list"
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            testID="discover-refresh-control"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <SearchFilterModal
        visible={filterModalVisible}
        filters={filters}
        categories={categories}
        onApply={handleApplyFilters}
        onClose={handleCloseFilters}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
}

// --- STYLES ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  searchContainer: {
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  filterBadge: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  sortButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  errorBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  autocompletePanel: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  autocompleteSuggestion: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  autocompleteSuggestionText: {
    fontSize: 14,
    color: '#333',
  },
  recentSearchesPanel: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  clearAllText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  recentSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  recentSearchButton: {
    flex: 1,
  },
  recentSearchText: {
    fontSize: 14,
    color: '#666',
  },
  removeRecentButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeRecentText: {
    fontSize: 16,
    color: '#999',
  },
  resultCard: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  resultImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  resultContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  spBadge: {
    marginLeft: 8,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  spellSuggestionButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  spellSuggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
