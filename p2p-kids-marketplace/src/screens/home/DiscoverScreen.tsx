/**
 * File: p2p-kids-marketplace/src/screens/home/DiscoverScreen.tsx
 * MODULE-05-DISCOVERY-V3: Unified Discover Screen
 * Task: DISCOVERY-V3-005 - DiscoverScreen (Unified)
 *
 * Replaces SearchScreen and BrowseItemsScreen with a single unified discovery experience
 * Features: debounced search, 9 filters, 4 sort options, infinite scroll, optimistic UI
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Modal as RNModal,
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
import { SortDropdown } from '@/components/atoms';
import { SearchFilterModal, ItemCard } from '@/components/molecules';
import {
  checkZipCodeHasActiveNode,
  getZipCodeCoordinates,
  getUserPreferredRadius,
  saveUserPreferredRadius,
} from '@/services/location';
import { upsertZipWaitlist } from '@/services/waitlist';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { getFavorites, toggleFavorite } from '@/services/favoritesService';
import { BookmarkSimple, MagnifyingGlass, FunnelSimple, X } from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';

// Search debounce constants: 200ms for active typing, 0ms for filter/sort changes
const KEYSTROKE_DEBOUNCE_MS = 200;
const FILTER_DEBOUNCE_MS = 0;

// Pagination batch size
const RESULTS_PER_PAGE = 20;
const AUTOCOMPLETE_MAX = 5;
const FALLBACK_DEFAULT_RADIUS_MILES = 10;
const FALLBACK_MIN_RADIUS_MILES = 5;
const FALLBACK_MAX_RADIUS_MILES = 100;

type NodesWithinRadiusRow = {
  id: string;
};

const dedupeResultsById = (items: SearchResult[]): SearchResult[] => {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
};

const mergeUniqueResults = (existing: SearchResult[], incoming: SearchResult[]): SearchResult[] => {
  const existingIds = new Set(existing.map((item) => item.id));
  const uniqueIncoming = incoming.filter((item) => !existingIds.has(item.id));
  return [...existing, ...uniqueIncoming];
};

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
  const { session } = useAuth();

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
  const [inactiveZipDialog, setInactiveZipDialog] = useState<{
    visible: boolean;
    zip: string;
    message: string;
  }>({
    visible: false,
    zip: '',
    message: '',
  });

  // Categories for filter modal
  const [categories, setCategories] = useState<any[]>([]);

  // Offset for pagination
  const [offset, setOffset] = useState(0);

  // Favorited item IDs for this user (Set for O(1) lookup)
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  // Location search state (ZIP + radius)
  const [zipCodeInput, setZipCodeInput] = useState('');
  const [appliedZipCode, setAppliedZipCode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(FALLBACK_DEFAULT_RADIUS_MILES);
  const [minRadiusMiles, setMinRadiusMiles] = useState(FALLBACK_MIN_RADIUS_MILES);
  const [maxRadiusMiles, setMaxRadiusMiles] = useState(FALLBACK_MAX_RADIUS_MILES);
  const [nodeIdsInScope, setNodeIdsInScope] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationFilterUnavailable, setLocationFilterUnavailable] = useState(false);
  const [inactiveZipMessage, setInactiveZipMessage] = useState<string | null>(null);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

  // Guards to prevent duplicate pagination requests and stale response races.
  const paginationRequestInFlightRef = useRef(false);
  const latestRequestIdRef = useRef(0);

  // Ref to hold performSearch for useFocusEffect (avoid TDZ issue)
  const performSearchRef = useRef<((opts?: { resetOffset?: boolean; forcedOffset?: number }) => Promise<void>) | null>(null);

  // --- COMPUTED VALUES ---

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const userId = session?.user?.user_id ?? null;
  const userEmail = session?.user?.email ?? null;

  const sanitizeZipCode = (value: string): string => value.replace(/\D/g, '').slice(0, 5);

  // --- LIFECYCLE ---

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Initialize ZIP/radius defaults from profile/user preferences.
  useEffect(() => {
    const initializeLocationDefaults = async () => {
      const sessionZip = sanitizeZipCode(session?.user?.zip_code || '');
      if (sessionZip.length === 5) {
        // Keep ZIP prefilled for convenience, but do not auto-apply location filter.
        // Requirement: load all discover items by default.
        setZipCodeInput(sessionZip);
      }

      if (!userId) {
        return;
      }

      const preferredRadius = await getUserPreferredRadius(userId);
      const clampedRadius = Math.max(
        FALLBACK_MIN_RADIUS_MILES,
        Math.min(FALLBACK_MAX_RADIUS_MILES, Math.round(preferredRadius || FALLBACK_DEFAULT_RADIUS_MILES))
      );
      setRadiusMiles(clampedRadius);
    };

    initializeLocationDefaults();
  }, [session?.user?.zip_code, userId]);

  const resolveNodeScopeByLocation = useCallback(async (zipCode: string, radius: number) => {
    if (!/^\d{5}$/.test(zipCode)) {
      setNodeIdsInScope([]);
      setLocationFilterUnavailable(false);
      setInactiveZipMessage(null);
      return [];
    }

    setLocationLoading(true);

    try {
      const hasActiveNode = await checkZipCodeHasActiveNode(zipCode);
      if (!hasActiveNode) {
        setInactiveZipMessage(
          `We are not live in ZIP ${zipCode} yet. We can add you to the waitlist.`
        );
      } else {
        setInactiveZipMessage(null);
      }

      const coordinates = await getZipCodeCoordinates(zipCode);
      if (!coordinates) {
        setNodeIdsInScope([]);
        setLocationFilterUnavailable(false);
        setError('Could not find this ZIP code. Please verify and try again.');
        return [];
      }

      const rpcPayloadLegacy = {
        center_lat: coordinates.latitude,
        center_lng: coordinates.longitude,
        radius_miles: radius,
      };
      const rpcPayloadPrefixed = {
        p_center_lat: coordinates.latitude,
        p_center_lng: coordinates.longitude,
        p_radius_miles: radius,
      };

      let nearbyNodes: NodesWithinRadiusRow[] | null = null;
      let nearbyNodesError: { code?: string; message?: string; details?: string; hint?: string } | null = null;

      const firstAttempt = await supabase.rpc('get_nodes_within_radius', rpcPayloadLegacy);
      if (!firstAttempt.error) {
        nearbyNodes = (firstAttempt.data || []) as NodesWithinRadiusRow[];
      } else {
        nearbyNodesError = firstAttempt.error;

        const firstAttemptText = `${firstAttempt.error.message || ''} ${firstAttempt.error.details || ''}`.toLowerCase();
        const mayBeSignatureMismatch =
          firstAttempt.error.code === 'PGRST202' ||
          firstAttemptText.includes('could not find the function') ||
          firstAttemptText.includes('schema cache');

        if (mayBeSignatureMismatch) {
          const secondAttempt = await supabase.rpc('get_nodes_within_radius', rpcPayloadPrefixed);
          if (!secondAttempt.error) {
            nearbyNodes = (secondAttempt.data || []) as NodesWithinRadiusRow[];
            nearbyNodesError = null;
          } else {
            nearbyNodesError = secondAttempt.error;
          }
        }
      }

      if (nearbyNodesError) {
        console.error(
          '[DiscoverScreen] get_nodes_within_radius failed:',
          JSON.stringify({
          code: nearbyNodesError.code,
          message: nearbyNodesError.message,
          details: nearbyNodesError.details,
          hint: nearbyNodesError.hint,
          })
        );

        const normalizedErrorText = `${nearbyNodesError.message || ''} ${nearbyNodesError.details || ''}`.toLowerCase();
        const hasTextVarcharMismatch =
          nearbyNodesError.code === '42804' ||
          normalizedErrorText.includes('returned type character varying') ||
          normalizedErrorText.includes('does not match expected type text');

        const hasMissingPostgisFunction =
          nearbyNodesError.code === '42883' ||
          normalizedErrorText.includes('st_distancesphere') ||
          normalizedErrorText.includes('st_makepoint') ||
          normalizedErrorText.includes('function') && normalizedErrorText.includes('does not exist');

        setNodeIdsInScope([]);
        setLocationFilterUnavailable(true);
        setError(
          hasTextVarcharMismatch || hasMissingPostgisFunction
            ? 'Location filter is temporarily unavailable due to a backend function mismatch. Showing broader results.'
            : 'Failed to search listings by location. Showing broader results. Tap to retry.'
        );
        return [];
      }

      const nextNodeIds = (nearbyNodes || [])
        .map((node) => node.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      setNodeIdsInScope(nextNodeIds);
      setLocationFilterUnavailable(false);
      return nextNodeIds;
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // Recalculate nodes whenever applied ZIP or radius changes.
  useEffect(() => {
    if (!/^\d{5}$/.test(appliedZipCode)) {
      setNodeIdsInScope([]);
      return;
    }

    resolveNodeScopeByLocation(appliedZipCode, radiusMiles);
  }, [appliedZipCode, radiusMiles, resolveNodeScopeByLocation]);

  // Pre-warm brand cache on mount
  useEffect(() => {
    fetchDatabaseBrands().catch((err) => {
      console.warn('[DiscoverScreen] Failed to pre-warm brand cache:', err);
    });
  }, []);

  // Perform search when debouncedQuery, debouncedFilters or debouncedSortBy change
  useEffect(() => {
    performSearch({ resetOffset: true });
  }, [debouncedQuery, debouncedFilters, debouncedSortBy, nodeIdsInScope, appliedZipCode]);

  // Load recent searches on mount and when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
      // Reload favorites whenever screen comes into focus
      if (session?.user) {
        getFavorites().then((r) => {
          if (r.success) {
            setFavoritedIds(new Set(r.data.map((f) => f.listingId)));
          }
        });
      }
      // Refresh listings to clear sold/expired items from stale client cache
      performSearchRef.current?.({ resetOffset: true });
    }, [session?.user])
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

      // Load admin radius config (best-effort; falls back to module constants)
      try {
        const { data: radiusRows } = await supabase
          .from('admin_config')
          .select('key, value')
          .in('key', ['default_radius_miles', 'min_user_radius_miles', 'max_user_radius_miles'])
          .eq('is_active', true);

        const radiusCfg: Record<string, number> = {};
        (radiusRows || []).forEach((row: { key: string; value: string }) => {
          const n = Number(row.value);
          if (!isNaN(n) && n > 0) radiusCfg[row.key] = n;
        });

        if (radiusCfg.min_user_radius_miles !== undefined) {
          setMinRadiusMiles(radiusCfg.min_user_radius_miles);
        }
        if (radiusCfg.max_user_radius_miles !== undefined) {
          setMaxRadiusMiles(radiusCfg.max_user_radius_miles);
        }
        if (radiusCfg.default_radius_miles !== undefined) {
          // Only set default if the user has no saved preference yet
          setRadiusMiles((prev) =>
            prev === FALLBACK_DEFAULT_RADIUS_MILES ? radiusCfg.default_radius_miles : prev
          );
        }
      } catch (radiusErr) {
        console.warn('[DiscoverScreen] Failed to load admin radius config:', radiusErr);
      }

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
        const requestId = latestRequestIdRef.current + 1;
        latestRequestIdRef.current = requestId;

        const newOffset =
          typeof forcedOffset === 'number' ? forcedOffset : resetOffset ? 0 : offset;

        const isPaginationRequest = !resetOffset && newOffset > 0;

        if (isPaginationRequest) {
          paginationRequestInFlightRef.current = true;
        }

        // For first page or filter change, show main loading indicator
        // For infinite scroll, show loadingMore indicator
        if (resetOffset || newOffset === 0) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        // Build filters with current query
        const hasLocationFilter = /^\d{5}$/.test(appliedZipCode) && !locationFilterUnavailable;
        const useScopedNodeIds = hasLocationFilter && nodeIdsInScope.length > 0;

        const searchFilters: DiscoveryFilters = {
          ...filters,
          query: debouncedQuery.trim() || undefined,
          sortBy,
          nodeIds: useScopedNodeIds ? nodeIdsInScope : undefined,
          limit: RESULTS_PER_PAGE,
          offset: newOffset,
        };

        const searchResults = await searchListings(debouncedQuery.trim(), searchFilters);

        // Ignore stale responses from older requests to prevent UI flicker/races.
        if (requestId !== latestRequestIdRef.current) {
          return;
        }

        const dedupedBatch = dedupeResultsById(searchResults);

        // Optimistic UI: append results for infinite scroll, replace for new search
        if (resetOffset || newOffset === 0) {
          setResults(dedupedBatch);
          setOffset(0);
          setHasMore(dedupedBatch.length === RESULTS_PER_PAGE);
        } else {
          const existingIds = new Set(results.map((item) => item.id));
          const uniqueCount = dedupedBatch.filter((item) => !existingIds.has(item.id)).length;

          setResults((prev) => mergeUniqueResults(prev, dedupedBatch));
          setOffset(newOffset);

          // Stop paging when backend repeats the same page (e.g., offset ignored or stale cache).
          setHasMore(dedupedBatch.length === RESULTS_PER_PAGE && uniqueCount > 0);
        }

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
        paginationRequestInFlightRef.current = false;
      }
    },
    [
      debouncedQuery,
      filters,
      sortBy,
      offset,
      results,
      nodeIdsInScope,
      appliedZipCode,
      locationFilterUnavailable,
    ]
  );

  // Sync performSearch ref so useFocusEffect can call it (avoids TDZ)
  performSearchRef.current = performSearch;

  /**
   * Handle reaching end of list (infinite scroll)
   */
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading || paginationRequestInFlightRef.current) {
      return; // Guard against duplicate fetches
    }

    paginationRequestInFlightRef.current = true;

    const newOffset = offset + RESULTS_PER_PAGE;
    performSearch({ resetOffset: false, forcedOffset: newOffset });
  }, [loadingMore, hasMore, loading, offset, performSearch]);

  /**
   * Toggle SP-only filtering directly from discover controls.
   */
  const handleQuickSPToggle = () => {
    setFilters((prev) => ({ ...prev, spEligibleOnly: !prev.spEligibleOnly }));
    setOffset(0);
  };

  /**
   * Apply ZIP filter from user input and auto-enroll waitlist when zip is inactive.
   */
  const handleApplyZipCode = async (): Promise<{
    ok: boolean;
    zip: string;
    isInactiveZip: boolean;
    waitlistNote?: string;
  }> => {
    const normalizedZip = sanitizeZipCode(zipCodeInput);
    setZipCodeInput(normalizedZip);
    setWaitlistMessage(null);

    if (!/^\d{5}$/.test(normalizedZip)) {
      setInactiveZipMessage('Enter a valid 5-digit ZIP code.');
      return { ok: false, zip: normalizedZip, isInactiveZip: false };
    }

    setAppliedZipCode(normalizedZip);
    const hasActiveNode = await checkZipCodeHasActiveNode(normalizedZip);

    if (hasActiveNode) {
      setWaitlistMessage(null);
      return { ok: true, zip: normalizedZip, isInactiveZip: false };
    }

    if (!hasActiveNode && userId && userEmail) {
      let waitlistNote = `Added you to the waitlist for ZIP ${normalizedZip}.`;
      try {
        // Note: assignedNodeId not passed because get_nodes_within_radius returns
        // geographic_nodes IDs, but zip_waitlist FK references public.nodes.
        // This will be fixed when migration 008_unify_nodes_table.sql is run.
        await upsertZipWaitlist({
          userId,
          email: userEmail,
          requestedZip: normalizedZip,
        });
        setWaitlistMessage(waitlistNote);
      } catch (waitlistError) {
        console.error('[DiscoverScreen] Waitlist enrollment failed:', waitlistError);
        waitlistNote = 'Could not add you to waitlist right now. Please try again.';
        setWaitlistMessage(waitlistNote);
      }
      return { ok: true, zip: normalizedZip, isInactiveZip: true, waitlistNote };
    }

    const signInNote = 'Sign in to be added to the waitlist for this ZIP.';
    setWaitlistMessage(signInNote);
    return { ok: true, zip: normalizedZip, isInactiveZip: true, waitlistNote: signInNote };
  };

  /**
   * Show alert when user tries to apply an inactive ZIP code
   */
  const showInactiveZipAlert = (zip: string, waitlistNote?: string) => {
    const alertMessage = waitlistNote
      ? `We're not live in ZIP code ${zip} yet. ${waitlistNote} In the meantime, you can browse all available items.`
      : `We're not live in ZIP code ${zip} yet. In the meantime, you can browse all available items.`;

    setInactiveZipDialog({
      visible: true,
      zip,
      message: alertMessage,
    });
  };

  const handleInactiveZipBackToFilters = () => {
    setInactiveZipDialog({ visible: false, zip: '', message: '' });
    setFilterModalVisible(true);
  };

  const handleInactiveZipSeeAllResults = () => {
    setInactiveZipDialog({ visible: false, zip: '', message: '' });
    // Clear location filter and show all items
    setAppliedZipCode('');
    setNodeIdsInScope([]);
    setWaitlistMessage(null);
    setInactiveZipMessage(null);
    setOffset(0);
  };

  /**
   * Keep ZIP input sanitized while user types in filter modal.
   */
  const handleZipCodeInputChange = useCallback((value: string) => {
    setZipCodeInput(sanitizeZipCode(value));
  }, []);

  /**
   * Update radius and persist preference.
   */
  const handleRadiusComplete = async (nextRadius: number) => {
    const clampedRadius = Math.max(minRadiusMiles, Math.min(maxRadiusMiles, Math.round(nextRadius)));
    setRadiusMiles(clampedRadius);

    if (!userId) {
      return;
    }

    try {
      await saveUserPreferredRadius(userId, clampedRadius);
    } catch (radiusError) {
      console.warn('[DiscoverScreen] Failed saving preferred radius:', radiusError);
    }
  };

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
  const handleApplyFilters = async (newFilters: DiscoveryFilters) => {
    const normalizedZip = sanitizeZipCode(zipCodeInput);

    let inactiveZipAlertPayload: { zip: string; waitlistNote?: string } | null = null;

    if (normalizedZip.length === 0) {
      // Clearing ZIP reverts to global discovery scope.
      setAppliedZipCode('');
      setNodeIdsInScope([]);
      setInactiveZipMessage(null);
      setWaitlistMessage(null);
    } else {
      const zipApplyResult = await handleApplyZipCode();
      if (!zipApplyResult.ok) {
        return;
      }
      if (zipApplyResult.isInactiveZip) {
        inactiveZipAlertPayload = {
          zip: zipApplyResult.zip,
          waitlistNote: zipApplyResult.waitlistNote,
        };
      }
    }

    setFilters(newFilters);
    setFilterModalVisible(false);
    setOffset(0);

    // Show inactive ZIP alert AFTER modal closes if ZIP was inactive
    if (inactiveZipAlertPayload) {
      const { zip, waitlistNote } = inactiveZipAlertPayload;
      // Small delay to let modal close animation complete
      setTimeout(() => {
        showInactiveZipAlert(zip, waitlistNote);
      }, 300);
    }
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
   * Toggle favorite state for an item — optimistic update, then syncs with DB
   */
  const handleToggleFavorite = useCallback(async (itemId: string) => {
    if (!session?.user) return;
    const isCurrentlyFavorited = favoritedIds.has(itemId);
    // Optimistic update
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFavorited) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    const r = await toggleFavorite(itemId, isCurrentlyFavorited);
    if (!r.success) {
      // Revert on failure
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFavorited) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }
        return next;
      });
      console.warn('[DiscoverScreen] toggleFavorite failed:', r.error.message);
    }
  }, [session?.user, favoritedIds]);

  /**
   * Handle retry after network error
   */
  const handleRetry = () => {
    performSearch({ resetOffset: true });
  };

  // --- RENDER HELPERS ---

  /**
   * Render a single search result card
   *
   * DEFERRED-DECISION (2026-07-13): Seller Group badges and "Matches Your Cart" indicators
   * were intentionally REMOVED from Discover/search grid item cards. This was a deliberate
   * partial revert — the badge approach was replaced by "More from this seller" page discovery
   * (see MoreFromThisSellerScreen). Do NOT add seller identity indicators back to Discover cards
   * without a product decision. The ItemCard component no longer accepts sellerGroupColor,
   * sellerGroupLabel, or matchesCart props.
   */
  const renderResult = useCallback(({ item }: { item: SearchResult }) => {
    const mainImageUrl = item.images && item.images.length > 0 ? item.images[0].url : null;

    return (
      <ItemCard
        id={item.id}
        title={item.title}
        price={item.price}
        imageUrl={mainImageUrl}
        isFavorite={favoritedIds.has(item.id)}
        acceptsSwapPoints={item.accepts_swap_points}
        onPress={() => handleResultPress(item.id)}
        onFavoritePress={() => handleToggleFavorite(item.id)}
        onSharePress={() => {
          // TODO: wire share handler
          console.log('[DiscoverScreen] Share pressed:', item.id);
        }}
        testID={`search-result-${item.id}`}
      />
    );
  }, [favoritedIds, handleToggleFavorite]);

  /**
   * Render list header (search input, filters, sort)
   */
  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8}>
              <MagnifyingGlass size={24} color="#374151" weight="regular" />
            </Pressable>
          )}
          {/* Search Input Container - Prevents re-mount of input */}
          <View style={[styles.searchContainer, navigation.canGoBack() && { marginLeft: 8 }]}>
            <View style={styles.searchInputWrapper}>
              <MagnifyingGlass
                size={20}
                color="#6B6B6B"
                weight="regular"
                style={{ marginRight: 8 }}
              />
              <TextInput
                testID="discover-search-input"
                accessibilityLabel="Search for items"
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor="#999999"
                value={query}
                onChangeText={handleQueryChange}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={16} color="#6B6B6B" weight="regular" />
                </Pressable>
              )}
            </View>
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
            <FunnelSimple size={20} color="#1A1A1A" weight="regular" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge} testID="filter-badge">
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Favorites shortcut bookmark icon */}
          <Pressable
            testID="discover-favorites-button"
            accessibilityLabel="View Favorites"
            style={styles.filterButton}
            onPress={() => navigation.navigate('Favorites')}
          >
            <BookmarkSimple size={22} color="#E85D75" weight="regular" />
          </Pressable>

          <SortDropdown value={sortBy} onChange={handleSortChange} />

          <Pressable
            testID="discover-sp-toggle"
            accessibilityLabel={`SP only filter ${filters.spEligibleOnly ? 'enabled' : 'disabled'}`}
            style={[styles.spQuickToggle, filters.spEligibleOnly && styles.spQuickToggleActive]}
            onPress={handleQuickSPToggle}
          >
            <Text
              style={[
                styles.spQuickToggleText,
                filters.spEligibleOnly && styles.spQuickToggleTextActive,
              ]}
            >
              SP Only
            </Text>
          </Pressable>
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
   * Render list footer (minimal loading more indicator)
   */
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingMore} testID="loading-more-indicator">
        <ActivityIndicator color="#9CA3AF" size="small" />
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
    <ScreenLayout variant="tab" title="Discover">
      {/* Search Input - Static at the top to prevent losing focus on re-renders */}
      {renderHeader()}

      <FlatList
        testID="discover-results-list"
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id}
        extraData={favoritedIds}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[styles.listContent, results.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            testID="discover-refresh-control"
            tintColor="#9CA3AF"
            colors={['#9CA3AF']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <SearchFilterModal
        visible={filterModalVisible}
        filters={filters}
        categories={categories}
        zipCodeInput={zipCodeInput}
        appliedZipCode={appliedZipCode}
        radiusMiles={radiusMiles}
        minRadiusMiles={minRadiusMiles}
        maxRadiusMiles={maxRadiusMiles}
        locationLoading={locationLoading}
        inactiveZipMessage={inactiveZipMessage}
        waitlistMessage={waitlistMessage}
        userProfileZip={sanitizeZipCode(session?.user?.zip_code || '')}
        onZipCodeInputChange={handleZipCodeInputChange}
        onRadiusChange={setRadiusMiles}
        onRadiusComplete={handleRadiusComplete}
        onApply={handleApplyFilters}
        onClose={handleCloseFilters}
      />

      <RNModal
        visible={inactiveZipDialog.visible}
        transparent
        animationType="fade"
        onRequestClose={handleInactiveZipSeeAllResults}
      >
        <View style={styles.inactiveZipModalOverlay}>
          <View style={styles.inactiveZipModalCard}>
            <Text style={styles.inactiveZipModalTitle}>Not Available in Your Area</Text>
            <Text style={styles.inactiveZipModalMessage}>{inactiveZipDialog.message}</Text>

            <View style={styles.inactiveZipModalActions}>
              <Pressable
                style={styles.inactiveZipSecondaryButton}
                onPress={handleInactiveZipBackToFilters}
                testID="inactive-zip-back-to-filters"
              >
                <Text style={styles.inactiveZipSecondaryButtonText}>Back to Filters</Text>
              </Pressable>

              <Pressable
                style={styles.inactiveZipPrimaryButton}
                onPress={handleInactiveZipSeeAllResults}
                testID="inactive-zip-see-all-results"
              >
                <Text style={styles.inactiveZipPrimaryButtonText}>See All Results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

    </ScreenLayout>
  );
}

// --- STYLES ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },

  searchContainer: {
    flex: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spQuickToggle: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#5DBB8E',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  spQuickToggleActive: {
    backgroundColor: '#5DBB8E',
  },
  spQuickToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  spQuickToggleTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  autocompleteSuggestion: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  autocompleteSuggestionText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  recentSearchesPanel: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F7F7F7',
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
    color: '#1A1A1A',
  },
  clearAllText: {
    fontSize: 12,
    color: '#5DBB8E',
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
    color: '#6B6B6B',
  },
  removeRecentButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeRecentText: {
    fontSize: 16,
    color: '#999999',
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
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#5DBB8E',
    borderRadius: 20,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  spellSuggestionButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#5DBB8E',
    borderRadius: 20,
  },
  spellSuggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inactiveZipModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inactiveZipModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  inactiveZipModalTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  inactiveZipModalMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B6B6B',
  },
  inactiveZipModalActions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  inactiveZipSecondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#C9C9C9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveZipSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  inactiveZipPrimaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveZipPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
