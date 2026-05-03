/**
 * File: p2p-kids-marketplace/src/services/searchHistory.ts
 * MODULE-05-DISCOVERY-V3: Search History Service
 * Task: DISCOVERY-V3-003 - Search History Management
 *
 * Manages recent search queries in AsyncStorage (client-side only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for recent searches
const STORAGE_KEY = '@kids_marketplace:recent_searches';

// Maximum number of recent searches to store
const MAX_RECENT_SEARCHES = 8;

/**
 * Get recent search queries
 * Returns up to 8 recent searches in LRU order (most recent first)
 *
 * @returns Promise<string[]> - Array of recent search queries
 */
export async function getRecentSearches(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const searches: string[] = JSON.parse(stored);
    return Array.isArray(searches) ? searches : [];
  } catch (error) {
    console.error('[searchHistory] Failed to get recent searches:', error);
    return [];
  }
}

/**
 * Add a search query to history
 * Deduplicates (case-insensitive), moves to front if exists, evicts oldest if > 8
 *
 * @param query - Search query to add
 */
export async function addSearchToHistory(query: string): Promise<void> {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length === 0) {
      return;
    }

    const recent = await getRecentSearches();

    // Remove existing entry (case-insensitive dedup)
    const normalizedQuery = trimmed.toLowerCase();
    const filtered = recent.filter((existing) => existing.toLowerCase() !== normalizedQuery);

    // Prepend new search (LRU - most recent first)
    const updated = [trimmed, ...filtered];

    // Cap at max size
    const capped = updated.slice(0, MAX_RECENT_SEARCHES);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch (error) {
    console.error('[searchHistory] Failed to add search to history:', error);
  }
}

/**
 * Remove a specific search query from history
 *
 * @param query - Search query to remove
 */
export async function removeSearchFromHistory(query: string): Promise<void> {
  try {
    const recent = await getRecentSearches();

    // Case-insensitive removal
    const normalizedQuery = query.toLowerCase();
    const filtered = recent.filter((existing) => existing.toLowerCase() !== normalizedQuery);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[searchHistory] Failed to remove search from history:', error);
  }
}

/**
 * Clear all search history
 */
export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[searchHistory] Failed to clear search history:', error);
  }
}

/**
 * Get autocomplete suggestions from recent searches
 * Returns searches that start with the query (case-insensitive), max 5
 *
 * @param query - Partial query string
 * @param max - Maximum suggestions to return (default 5)
 * @returns Promise<string[]> - Matching recent searches
 */
export async function getAutocompleteSuggestions(
  query: string,
  max: number = 5
): Promise<string[]> {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length === 0) {
      return [];
    }

    const recent = await getRecentSearches();
    const normalizedQuery = trimmed.toLowerCase();

    // Filter by startsWith (case-insensitive)
    const matches = recent.filter((search) => search.toLowerCase().startsWith(normalizedQuery));

    // Return max N matches
    return matches.slice(0, max);
  } catch (error) {
    console.error('[searchHistory] Failed to get autocomplete suggestions:', error);
    return [];
  }
}
