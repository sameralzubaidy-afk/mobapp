/**
 * File: p2p-kids-marketplace/src/screens/home/SearchScreen.tsx
 * MODULE-05-DISCOVERY-V2: Search UI
 * Task: DISCOVERY-V2-001 - Full-Text Search
 * 
 * Search screen with real-time results, SP filtering, and relevance display
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { searchListings } from '../../services/discovery';
import { SearchResult } from '../../types/discovery';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import BottomNavBar from '../../components/organisms/BottomNavBar';

type Props = NativeStackScreenProps<any, 'Search'>;

/**
 * SearchScreen Component
 * 
 * Features:
 * - Real-time full-text search
 * - SP-eligible toggle filter
 * - Relevance score display (dev mode)
 * - Item preview cards
 * - Navigation to item details
 */
export const SearchScreen: React.FC<Props> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [spEligibleOnly, setSpEligibleOnly] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Perform search with debouncing
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasSearched(false);
        setSearchError(null);
        return;
      }

      try {
        setLoading(true);
        setHasSearched(true);
        setSearchError(null);

        const searchResults = await searchListings(searchQuery, {
          spEligibleOnly,
          limit: 20,
        });

        setResults(searchResults);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setSearchError(errorMessage);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [spEligibleOnly]
  );

  // Debounce search on query change
  const debouncedSearch = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (searchQuery: string) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => performSearch(searchQuery), 300); // 300ms debounce
    };
  }, [performSearch]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    debouncedSearch(newQuery);
  };

  const handleSpEligibleToggle = () => {
    setSpEligibleOnly(!spEligibleOnly);
    // Re-search with new filter
    if (query.trim()) {
      performSearch(query);
    }
  };

  const handleItemPress = (itemId: string) => {
    navigation.navigate('ItemDetail', { itemId });
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={styles.resultCard}
      onPress={() => handleItemPress(item.id)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.resultMeta}>
          <Text style={styles.priceText}>
            ${(item.price as number).toFixed(2)}
          </Text>

          {item.accepts_swap_points && (
            <Text style={styles.spBadge}>✓ SP Eligible</Text>
          )}
        </View>

        {/* Dev mode: Show relevance score */}
        {__DEV__ && (
          <Text style={styles.relevanceText}>
            Relevance: {(item.relevance * 100).toFixed(0)}%
          </Text>
        )}
      </View>
    </Pressable>
  );

  const renderEmptyState = () => {
    if (loading) {
      return null; // ActivityIndicator handles loading
    }

    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Search for Items</Text>
          <Text style={styles.emptySubtitle}>
            Enter keywords like "toy", "game", or "book"
          </Text>
        </View>
      );
    }

    if (searchError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Search Error</Text>
          <Text style={styles.errorSubtext}>{searchError}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Results Found</Text>
        <Text style={styles.emptySubtitle}>
          Try searching with different keywords
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={handleQueryChange}
            editable={!loading}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                setResults([]);
                setHasSearched(false);
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* SP Filter Toggle */}
        <Pressable
          style={[
            styles.filterButton,
            spEligibleOnly && styles.filterButtonActive,
          ]}
          onPress={handleSpEligibleToggle}
          disabled={loading}
        >
          <Text
            style={[
              styles.filterButtonText,
              spEligibleOnly && styles.filterButtonTextActive,
            ]}
          >
            SP Only
          </Text>
        </Pressable>
      </View>

      {/* Results List or Empty State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          style={styles.resultsList}
          contentContainerStyle={styles.resultsListContent}
          scrollIndicatorInsets={{ right: 1 }}
        />
      ) : (
        <ScrollView
          style={styles.emptyScroll}
          contentContainerStyle={styles.emptyScrollContent}
        >
          {renderEmptyState()}
        </ScrollView>
      )}

      {/* Results Count */}
      {results.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.resultCountText}>
            Found {results.length} item{results.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Unified Navigation Bar */}
      <BottomNavBar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#999',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultCard: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultContent: {
    gap: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  spBadge: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '600',
    backgroundColor: '#d5f4e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  relevanceText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyScroll: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e74c3c',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#c0392b',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  resultCountText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default SearchScreen;
