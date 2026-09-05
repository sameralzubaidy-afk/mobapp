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
  Keyboard,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Modal as RNModal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchListings, getTopCategoriesByState, countListings } from '@/services/discovery';
import { computeEffectiveNodeScope } from '@/utils/nodeScope';
import {
  getRecentSearches,
  addSearchToHistory,
  clearSearchHistory,
  getAutocompleteSuggestions,
} from '@/services/searchHistory';
import { fetchDatabaseBrands } from '@/services/brandAutocomplete';
import { suggestSpellingCorrection } from '@/services/discovery';
import { countActiveFilters, getDefaultFilters } from '@/utils/filterHelpers';
import { SearchResult, DiscoveryFilters, SortOption, TrendingCategory } from '@/types/discovery';
import { getCategories } from '@/services/items';
import { captureException } from '@/services/errorReporter';
import { SortDropdown } from '@/components/atoms';
import { SearchFilterModal, ItemCard } from '@/components/molecules';
import {
  checkZipCodeHasActiveNode,
  getZipCodeCoordinates,
  getUserPreferredRadius,
  saveUserPreferredRadius,
} from '@/services/location';
import { upsertZipWaitlist, isUserOnWaitlist } from '@/services/waitlist';
import { useAuth, useSubscriptionStatus } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { getFavorites, toggleFavorite } from '@/services/favoritesService';
import { MagnifyingGlass, FunnelSimple, X, Coins, GlobeSimple } from 'phosphor-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DiscoverHeader from './DiscoverHeader';
import { ds, dsRadii, dsType } from '@/theme/discoveryTokens';
import { componentSize, spacing } from '@/theme/spacing';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

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

  // Fix 4 (2026-08-22): Free users toggling the "Accepts SP" filter (header
  // quick-toggle OR Filters-sheet toggle — both write filters.spEligibleOnly)
  // or viewing SP-eligible results get the Kids Club+ upgrade CTA. Single gate:
  // canSpendSP (subscriber-only) + SP filter active.
  const { canSpendSP } = useSubscriptionStatus();

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
  // ZIP waitlist consent dialog (2026-08-22): two-step — an explicit Yes/No
  // consent step BEFORE any zip_waitlist row is created, then an outcome step
  // that preserves the Back to Filters / See All Results navigation.
  const [inactiveZipDialog, setInactiveZipDialog] = useState<{
    visible: boolean;
    step: 'consent' | 'confirmed' | 'none';
    zip: string;
    enrolled: boolean;
    signInRequired: boolean;
    enrollmentFailed: boolean;
  }>({
    visible: false,
    step: 'none',
    zip: '',
    enrolled: false,
    signInRequired: false,
    enrollmentFailed: false,
  });

  // Categories for filter modal
  const [categories, setCategories] = useState<any[]>([]);

  // Offset for pagination
  const [offset, setOffset] = useState(0);

  // Favorited item IDs for this user (Set for O(1) lookup)
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  // DISCOVER-REDESIGN: Trending categories (state-scoped) + live result count
  const [trending, setTrending] = useState<TrendingCategory[]>([]);
  const [totalResultCount, setTotalResultCount] = useState<number | null>(null);

  // Location search state (ZIP + radius)
  const [zipCodeInput, setZipCodeInput] = useState('');
  const [appliedZipCode, setAppliedZipCode] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(FALLBACK_DEFAULT_RADIUS_MILES);
  const [minRadiusMiles, setMinRadiusMiles] = useState(FALLBACK_MIN_RADIUS_MILES);
  const [maxRadiusMiles, setMaxRadiusMiles] = useState(FALLBACK_MAX_RADIUS_MILES);
  // DEV-TASK-115 item 3: the admin-configured default_radius_miles, so the
  // filter modal can label whether the slider's starting value is the user's
  // saved preference or the config default.
  const [defaultRadiusMiles, setDefaultRadiusMiles] = useState(FALLBACK_DEFAULT_RADIUS_MILES);
  const [nodeIdsInScope, setNodeIdsInScope] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationFilterUnavailable, setLocationFilterUnavailable] = useState(false);
  const [inactiveZipMessage, setInactiveZipMessage] = useState<string | null>(null);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

  // P4 (2026-08-17): "Show All Nodes" opt-in toggle + waitlisted detection.
  // Active-node users default to "My Node"; the toggle widens to all nodes.
  // Waitlisted users keep the intentional global-browse fallback (demand signal).
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);

  // Guards to prevent duplicate pagination requests and stale response races.
  const paginationRequestInFlightRef = useRef(false);
  const latestRequestIdRef = useRef(0);

  // Ref to hold performSearch for useFocusEffect (avoid TDZ issue)
  const performSearchRef = useRef<
    ((opts?: { resetOffset?: boolean; forcedOffset?: number }) => Promise<void>) | null
  >(null);

  // --- COMPUTED VALUES ---

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  // Group M P2: when the empty state shows the "Clear Filters" action, the
  // software keyboard can push that action below the fold and make it
  // unreachable. Dismiss the keyboard once each time this empty-state variant
  // renders so the action is always reachable. (While the user keeps typing in
  // this same state the boolean doesn't change, so it won't re-dismiss and
  // interrupt them.)
  const showClearFiltersEmptyState = !loading && results.length === 0 && activeFilterCount > 0;

  useEffect(() => {
    if (showClearFiltersEmptyState) {
      Keyboard.dismiss();
    }
  }, [showClearFiltersEmptyState]);

  const userId = session?.user?.user_id ?? null;
  const userEmail = session?.user?.email ?? null;

  // User's detected state (for "Trending in {State}") — derived from the node
  // assigned at onboarding. Null when the user has no node (waitlist).
  const userState = (session?.user as any)?.node?.state as string | undefined;

  // P4 (2026-08-17): the signed-in user's node id (profile row or embedded
  // node join). Null when the user has no node (waitlist-only) → global default.
  const userNodeId =
    ((session?.user as any)?.node_id as string | null) ??
    ((session?.user as any)?.node?.id as string | null) ??
    null;

  // DISCOVER-REDESIGN: active-filter chips rendered above the grid. Each entry
  // is one currently-applied filter; the SP chip uses SP-Gold tokens, all other
  // chips use Primary tokens (per product requirement).
  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; isSp: boolean }[] = [];
    const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Category';

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const label =
        filters.categoryIds.length === 1
          ? categoryName(filters.categoryIds[0])
          : `${filters.categoryIds.length} Categories`;
      chips.push({ key: 'categoryIds', label, isSp: false });
    }
    if (filters.ageGroup) {
      chips.push({ key: 'ageGroup', label: `Age: ${filters.ageGroup}`, isSp: false });
    }
    if (filters.condition) {
      const pretty = filters.condition
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      chips.push({ key: 'condition', label: `Condition: ${pretty}`, isSp: false });
    }
    if (filters.gender) {
      chips.push({ key: 'gender', label: `Gender: ${filters.gender}`, isSp: false });
    }
    if (filters.colors && filters.colors.length > 0) {
      chips.push({ key: 'colors', label: `Color: ${filters.colors.length} selected`, isSp: false });
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const min = filters.minPrice !== undefined ? `$${filters.minPrice}` : 'Any';
      const max = filters.maxPrice !== undefined ? `$${filters.maxPrice}` : 'Any';
      chips.push({ key: 'price', label: `Price: ${min}–${max}`, isSp: false });
    }
    if (filters.brand && filters.brand.trim().length > 0) {
      chips.push({ key: 'brand', label: `Brand: ${filters.brand}`, isSp: false });
    }
    if (filters.spEligibleOnly) {
      chips.push({ key: 'spEligibleOnly', label: 'Accepts SP', isSp: true });
    }
    return chips;
  }, [filters, categories]);

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
        Math.min(
          FALLBACK_MAX_RADIUS_MILES,
          Math.round(preferredRadius || FALLBACK_DEFAULT_RADIUS_MILES)
        )
      );
      setRadiusMiles(clampedRadius);
    };

    initializeLocationDefaults();
  }, [session?.user?.zip_code, userId]);

  // P4 (2026-08-17) + ZIP-waitlist decouple (2026-08-22): Detect waitlisted
  // status. A user is "waitlisted" (keeps the intentional global-browse
  // fallback) ONLY when their zip_waitlist row is tied to their own home ZIP —
  // the one established during onboarding when they have no active node. Rows
  // created via ad-hoc filter exploration of a *different* ZIP (explicit
  // opt-in) must NOT flip the user's own browsing default. On query failure,
  // default to active-node (scope) so the hyperlocal fix can't silently
  // regress; log for diagnosability.
  useEffect(() => {
    let cancelled = false;
    const checkWaitlistStatus = async () => {
      if (!userId) {
        if (!cancelled) setWaitlisted(false);
        return;
      }
      const homeZip = sanitizeZipCode(session?.user?.zip_code || '');
      if (homeZip.length !== 5) {
        // No known home ZIP → never treat the user as waitlisted for scope.
        if (!cancelled) setWaitlisted(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('zip_waitlist')
          .select('id')
          .eq('user_id', userId)
          .eq('requested_zip', homeZip)
          .in('status', ['pending', 'notified'])
          .maybeSingle();
        if (!cancelled) setWaitlisted(!error && !!data);
      } catch (err) {
        console.warn('[DiscoverScreen] waitlist check failed (non-fatal):', err);
        if (!cancelled) setWaitlisted(false);
      }
    };
    checkWaitlistStatus();
    return () => {
      cancelled = true;
    };
  }, [userId, session?.user?.zip_code]);

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
      let nearbyNodesError: {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      } | null = null;

      const firstAttempt = await supabase.rpc('get_nodes_within_radius', rpcPayloadLegacy);
      if (!firstAttempt.error) {
        nearbyNodes = (firstAttempt.data || []) as NodesWithinRadiusRow[];
      } else {
        nearbyNodesError = firstAttempt.error;

        const firstAttemptText =
          `${firstAttempt.error.message || ''} ${firstAttempt.error.details || ''}`.toLowerCase();
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
        captureException(nearbyNodesError, {
          tags: { screen: 'DiscoverScreen', action: 'get_nodes_within_radius' },
        });

        const normalizedErrorText =
          `${nearbyNodesError.message || ''} ${nearbyNodesError.details || ''}`.toLowerCase();
        const hasTextVarcharMismatch =
          nearbyNodesError.code === '42804' ||
          normalizedErrorText.includes('returned type character varying') ||
          normalizedErrorText.includes('does not match expected type text');

        const hasMissingPostgisFunction =
          nearbyNodesError.code === '42883' ||
          normalizedErrorText.includes('st_distancesphere') ||
          normalizedErrorText.includes('st_makepoint') ||
          (normalizedErrorText.includes('function') &&
            normalizedErrorText.includes('does not exist'));

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

  // Perform search when debouncedQuery, debouncedFilters, debouncedSortBy or
  // the node scope (showAllNodes / waitlisted / userNodeId) change.
  // DEV-TASK-48 (perf): skip the FIRST run — useFocusEffect already performs the
  // initial search on mount/focus, so without this guard search_listings +
  // count_listings + item_images fire twice on first load.
  const initialSearchRef = useRef(false);
  useEffect(() => {
    if (!initialSearchRef.current) {
      initialSearchRef.current = true;
      return;
    }
    performSearch({ resetOffset: true });
  }, [
    debouncedQuery,
    debouncedFilters,
    debouncedSortBy,
    nodeIdsInScope,
    appliedZipCode,
    showAllNodes,
    waitlisted,
    userNodeId,
  ]);

  /**
   * Load trending categories scoped to the user's state (DISCOVER-REDESIGN).
   * MVP: supply-side metric — top categories by active listing count.
   * // TODO(backlog): this listing-count metric is supply-side and may always
   * surface the same 1-2 largest categories. A future iteration should weight
   * by listing *velocity* (new listings in last 7 days) or actual search/view
   * volume once analytics exist, to make "trending" feel dynamic rather than
   * static.
   */
  const loadTrending = useCallback(async () => {
    if (!userState) {
      setTrending([]);
      return;
    }

    try {
      const trendingData = await getTopCategoriesByState(userState, 6);
      setTrending(trendingData || []);
    } catch (err) {
      console.warn('[DiscoverScreen] Failed to load trending:', err);
      setTrending([]); // Hide the section on error — non-blocking
    }
  }, [userState]);

  // Load recent searches on mount and when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
      loadTrending();
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
    }, [session?.user, loadTrending])
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
          setDefaultRadiusMiles(radiusCfg.default_radius_miles);
          // Only apply the configured default as the starting radius if the
          // user has no saved preference yet (still at the module fallback).
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

      // DEV-TASK-48 (perf): trending is loaded in useFocusEffect — remove the
      // duplicate call here so get_top_categories_by_state fires once, not twice,
      // on first mount.
    } catch (err) {
      captureException(err, {
        tags: { screen: 'DiscoverScreen', action: 'load_initial_data' },
        extra: { message: err instanceof Error ? err.message : String(err) },
      });
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

        // Build filters with current query + node scope (P4 hyperlocal default:
        // active-node users see "My Node" unless they opt into Show All Nodes).
        const hasLocationFilter = /^\d{5}$/.test(appliedZipCode) && !locationFilterUnavailable;
        const nodeScope = computeEffectiveNodeScope({
          userNodeId,
          isWaitlisted: waitlisted,
          showAllNodes,
          hasActiveLocationFilter: hasLocationFilter,
          locationScopeNodeIds: nodeIdsInScope,
        });

        const searchFilters: DiscoveryFilters = {
          ...filters,
          query: debouncedQuery.trim() || undefined,
          sortBy,
          nodeIds: nodeScope.nodeIds ?? undefined,
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

        // DISCOVER-REDESIGN: fetch the total matching count for the result-count
        // line above the grid. Lightweight count_listings RPC; non-fatal — falls
        // back to the loaded page size on error.
        if (resetOffset || newOffset === 0) {
          try {
            const total = await countListings(debouncedQuery.trim(), searchFilters);
            if (requestId === latestRequestIdRef.current) {
              setTotalResultCount(total);
            }
          } catch (countErr) {
            console.warn('[DiscoverScreen] countListings failed:', countErr);
            setTotalResultCount(dedupedBatch.length);
          }
        }

        // Add to search history if query is non-empty
        if (debouncedQuery.trim().length > 0) {
          await addSearchToHistory(debouncedQuery.trim());
          await loadRecentSearches();
        }
      } catch (err) {
        captureException(err, {
          tags: { screen: 'DiscoverScreen', action: 'search' },
          extra: { message: err instanceof Error ? err.message : String(err) },
        });
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
      showAllNodes,
      waitlisted,
      userNodeId,
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
   * Toggle the SP-eligible filter from the Discover controls OR the Filters sheet.
   * Single source of truth: filters.spEligibleOnly — the header chip and the sheet
   * toggle both read/write this one boolean so they can never desync.
   * @param nextValue - Optional explicit value (sheet Switch). Omit to toggle.
   */
  const handleToggleSpEligible = (nextValue?: boolean) => {
    setFilters((prev) => ({
      ...prev,
      spEligibleOnly: typeof nextValue === 'boolean' ? nextValue : !prev.spEligibleOnly,
    }));
    setOffset(0);
  };

  /**
   * Remove a single active filter by key (active-filter chip "×" control).
   * Each removal refetches via the debounced filters effect.
   */
  const handleRemoveFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const next: DiscoveryFilters = { ...prev };
      switch (key) {
        case 'categoryIds':
          delete next.categoryIds;
          break;
        case 'ageGroup':
          delete next.ageGroup;
          break;
        case 'condition':
          delete next.condition;
          break;
        case 'gender':
          delete next.gender;
          break;
        case 'colors':
          delete next.colors;
          break;
        case 'price':
          delete next.minPrice;
          delete next.maxPrice;
          break;
        case 'brand':
          delete next.brand;
          break;
        case 'spEligibleOnly':
          delete next.spEligibleOnly;
          break;
      }
      return next;
    });
    setOffset(0);
  }, []);

  /**
   * Reset all active filters and refetch unfiltered results ("Clear all").
   */
  const handleClearAllActiveFilters = useCallback(() => {
    setFilters(getDefaultFilters());
    setOffset(0);
  }, []);

  /**
   * Browse a trending category (sets the category filter + refetch).
   */
  const handleTrendingTap = useCallback((cat: TrendingCategory) => {
    setFilters((prev) => ({ ...prev, categoryIds: [cat.category_id] }));
    setOffset(0);
  }, []);

  /**
   * Apply ZIP filter from user input. (2026-08-22) For an inactive ZIP this NO
   * LONGER auto-enrolls the user in zip_waitlist — the consent dialog asks for
   * explicit Yes/No before any row is created. This only reports whether the
   * user is already on this ZIP's waitlist so the dialog can skip consent on
   * repeat visits.
   */
  const handleApplyZipCode = async (): Promise<{
    ok: boolean;
    zip: string;
    isInactiveZip: boolean;
    alreadyWaitlisted: boolean;
  }> => {
    const normalizedZip = sanitizeZipCode(zipCodeInput);
    setZipCodeInput(normalizedZip);
    setWaitlistMessage(null);

    if (!/^\d{5}$/.test(normalizedZip)) {
      setInactiveZipMessage('Enter a valid 5-digit ZIP code.');
      return { ok: false, zip: normalizedZip, isInactiveZip: false, alreadyWaitlisted: false };
    }

    setAppliedZipCode(normalizedZip);
    const hasActiveNode = await checkZipCodeHasActiveNode(normalizedZip);

    if (hasActiveNode) {
      setWaitlistMessage(null);
      return { ok: true, zip: normalizedZip, isInactiveZip: false, alreadyWaitlisted: false };
    }

    // Inactive ZIP: no row is created here. Just check existing membership so
    // the dialog can skip the consent step for ZIPs the user already opted into.
    let alreadyWaitlisted = false;
    if (userId) {
      alreadyWaitlisted = await isUserOnWaitlist(userId, normalizedZip);
    }
    setWaitlistMessage(null);
    return { ok: true, zip: normalizedZip, isInactiveZip: true, alreadyWaitlisted };
  };

  /**
   * Show the inactive-ZIP dialog. (2026-08-22) Two-step: an explicit Yes/No
   * consent step BEFORE any zip_waitlist row is created, then an outcome step
   * preserving the Back to Filters / See All Results navigation. Signed-out
   * users cannot enroll and skip straight to the outcome step with a sign-in
   * note; already-waitlisted users skip the consent step on repeat visits.
   */
  const showInactiveZipDialog = (zip: string, alreadyWaitlisted: boolean) => {
    if (!userId) {
      setInactiveZipDialog({
        visible: true,
        step: 'confirmed',
        zip,
        enrolled: false,
        signInRequired: true,
        enrollmentFailed: false,
      });
      return;
    }
    if (alreadyWaitlisted) {
      // Already explicitly on this ZIP's list — confirm, don't re-ask.
      setInactiveZipDialog({
        visible: true,
        step: 'confirmed',
        zip,
        enrolled: true,
        signInRequired: false,
        enrollmentFailed: false,
      });
      return;
    }
    setInactiveZipDialog({
      visible: true,
      step: 'consent',
      zip,
      enrolled: false,
      signInRequired: false,
      enrollmentFailed: false,
    });
  };

  /** Explicit "Yes" — only now create the zip_waitlist row. */
  const handleWaitlistOptInYes = async () => {
    if (!inactiveZipDialog.visible || !inactiveZipDialog.zip) {
      return;
    }
    const zip = inactiveZipDialog.zip;
    if (!userId || !userEmail) {
      setInactiveZipDialog({
        visible: true,
        step: 'confirmed',
        zip,
        enrolled: false,
        signInRequired: true,
        enrollmentFailed: false,
      });
      return;
    }
    try {
      await upsertZipWaitlist({ userId, email: userEmail, requestedZip: zip });
      setInactiveZipDialog({
        visible: true,
        step: 'confirmed',
        zip,
        enrolled: true,
        signInRequired: false,
        enrollmentFailed: false,
      });
    } catch (enrollError) {
      captureException(enrollError, {
        tags: { screen: 'DiscoverScreen', action: 'waitlist_enrollment' },
      });
      setInactiveZipDialog({
        visible: true,
        step: 'confirmed',
        zip,
        enrolled: false,
        signInRequired: false,
        enrollmentFailed: true,
      });
    }
  };

  /** Explicit "No" — no row created; proceed to the outcome step. */
  const handleWaitlistOptInNo = () => {
    if (!inactiveZipDialog.visible || !inactiveZipDialog.zip) {
      return;
    }
    setInactiveZipDialog({
      visible: true,
      step: 'confirmed',
      zip: inactiveZipDialog.zip,
      enrolled: false,
      signInRequired: false,
      enrollmentFailed: false,
    });
  };

  /** Outcome-step message (enrolled / declined / sign-in / failure). */
  const inactiveZipOutcomeMessage = (): string => {
    const { zip, enrolled, signInRequired, enrollmentFailed } = inactiveZipDialog;
    if (signInRequired) {
      return `We're not live in ZIP ${zip} yet. Sign in to be added to the waitlist for this ZIP. In the meantime, you can browse all available items.`;
    }
    if (enrollmentFailed) {
      return `We couldn't add you to the waitlist for ZIP ${zip} right now. Please try again later. In the meantime, you can browse all available items.`;
    }
    if (enrolled) {
      return `You're on the waitlist for ZIP ${zip}. We'll let you know when we launch here. In the meantime, you can browse all available items.`;
    }
    return 'No problem — you can still browse everything on Pass It Up.';
  };

  const resetInactiveZipDialog = () => {
    setInactiveZipDialog({
      visible: false,
      step: 'none',
      zip: '',
      enrolled: false,
      signInRequired: false,
      enrollmentFailed: false,
    });
  };

  const handleInactiveZipBackToFilters = () => {
    resetInactiveZipDialog();
    setFilterModalVisible(true);
  };

  const handleInactiveZipSeeAllResults = () => {
    resetInactiveZipDialog();
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
    const clampedRadius = Math.max(
      minRadiusMiles,
      Math.min(maxRadiusMiles, Math.round(nextRadius))
    );
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

    let inactiveZipDialogPayload: { zip: string; alreadyWaitlisted: boolean } | null = null;

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
        inactiveZipDialogPayload = {
          zip: zipApplyResult.zip,
          alreadyWaitlisted: zipApplyResult.alreadyWaitlisted,
        };
      }
    }

    setFilters(newFilters);
    setFilterModalVisible(false);
    setOffset(0);

    // Show inactive ZIP dialog AFTER modal closes if ZIP was inactive
    if (inactiveZipDialogPayload) {
      const { zip, alreadyWaitlisted } = inactiveZipDialogPayload;
      // Small delay to let modal close animation complete
      setTimeout(() => {
        showInactiveZipDialog(zip, alreadyWaitlisted);
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
  const handleToggleFavorite = useCallback(
    async (itemId: string) => {
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
    },
    [session?.user, favoritedIds]
  );

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
  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      const mainImageUrl = item.images && item.images.length > 0 ? item.images[0].url : null;

      // P4: "Other Node" badge — only meaningful while the user is deliberately
      // browsing beyond their own node ("Show All Nodes" on).
      const isOtherNode =
        showAllNodes && !!item.node_id && !!userNodeId && item.node_id !== userNodeId;

      return (
        <ItemCard
          id={item.id}
          title={item.title}
          price={item.price}
          imageUrl={mainImageUrl}
          isFavorite={favoritedIds.has(item.id)}
          acceptsSwapPoints={item.accepts_swap_points}
          otherNode={isOtherNode}
          onPress={() => handleResultPress(item.id)}
          onFavoritePress={() => handleToggleFavorite(item.id)}
          onSharePress={() => {
            // TODO: wire share handler
            console.log('[DiscoverScreen] Share pressed:', item.id);
          }}
          testID={`search-result-${item.id}`}
        />
      );
    },
    [favoritedIds, handleToggleFavorite, showAllNodes, userNodeId]
  );

  /**
   * Render list header (search input, filters, sort)
   */
  const renderHeader = () => {
    // DISCOVER-REDESIGN: result count + location line above the grid.
    const resultCount = totalResultCount ?? results.length;
    const locationLabel = /^\d{5}$/.test(appliedZipCode)
      ? `near ${appliedZipCode}, ${radiusMiles} mi`
      : showAllNodes
        ? 'all nodes'
        : userState
          ? `near ${userState}`
          : '';
    // Hide Recent/Trending sections while the user is actively typing in search
    // (the autocomplete panel takes over then).
    const showDiscoverySections = !(searchFocused && query.trim().length > 0);

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
              <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
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
                <Pressable
                  testID="discover-search-clear"
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery('')}
                  hitSlop={8}
                >
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
            accessible
            accessibilityRole="button"
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

          {/* Favorites lives in the header bookmark only (no duplicate next to Sort). */}
          <SortDropdown value={sortBy} onChange={handleSortChange} />

          <Pressable
            testID="discover-sp-toggle"
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Accepts Swap Points filter ${filters.spEligibleOnly ? 'enabled' : 'disabled'}`}
            accessibilityState={{ selected: filters.spEligibleOnly === true }}
            style={[styles.spQuickToggle, filters.spEligibleOnly && styles.spQuickToggleActive]}
            onPress={() => handleToggleSpEligible()}
          >
            <Coins
              size={16}
              color={filters.spEligibleOnly ? ds.sp[500] : ds.neutral[700]}
              weight="fill"
            />
            <Text
              style={[
                styles.spQuickToggleText,
                filters.spEligibleOnly && styles.spQuickToggleTextActive,
              ]}
            >
              Accepts SP
            </Text>
          </Pressable>
        </View>

        {/* Fix 4 (2026-08-22): Free-user upgrade CTA for the SP filter. Shown
            whenever a non-subscriber has the "Accepts SP" filter active — via
            the header quick-toggle, the Filters-sheet toggle, or simply
            viewing SP-eligible results. Mirrors ItemCreateScreen's Payment
            Preference upgrade prompt (AUTH-TC-J07): same copy + "Upgrade Now"
            → Subscription Choice (JoinKidsClub). */}
        {!canSpendSP && filters.spEligibleOnly === true && (
          <View style={styles.spUpgradePrompt} testID="discover-sp-upgrade-cta">
            <Text style={styles.spUpgradeText}>
              🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!
            </Text>
            <Pressable
              testID="discover-sp-upgrade-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Kids Club+"
              style={styles.spUpgradeButton}
              onPress={() => navigation.navigate('JoinKidsClub')}
            >
              <Text style={styles.spUpgradeButtonText}>Upgrade Now</Text>
            </Pressable>
          </View>
        )}

        {/* P4: "My Node" default + "Show All Nodes" opt-in (hyperlocal discovery).
            Only rendered for signed-in active-node users; waitlisted users keep
            their global-browse fallback and never see this toggle. */}
        {!!userNodeId && !waitlisted && (
          <View style={styles.showAllNodesRow}>
            <Pressable
              testID="discover-show-all-nodes-toggle"
              accessible
              accessibilityRole="switch"
              accessibilityState={{ selected: showAllNodes }}
              accessibilityLabel={`Show All Nodes ${showAllNodes ? 'on' : 'off'}`}
              style={[styles.showAllNodesToggle, showAllNodes && styles.showAllNodesToggleActive]}
              onPress={() => setShowAllNodes((prev) => !prev)}
            >
              <GlobeSimple
                size={16}
                color={showAllNodes ? ds.primary[600] : ds.neutral[700]}
                weight={showAllNodes ? 'fill' : 'regular'}
              />
              <Text
                style={[
                  styles.showAllNodesToggleText,
                  showAllNodes && styles.showAllNodesToggleTextActive,
                ]}
              >
                Show All Nodes
              </Text>
              <Text style={styles.showAllNodesToggleHint}>{showAllNodes ? 'On' : 'Off'}</Text>
            </Pressable>
          </View>
        )}

        {/* DISCOVER-REDESIGN: Result count + active filter chips (above the grid) */}
        {results.length > 0 && (
          <View style={styles.resultsSummary} testID="discover-results-summary">
            <Text style={styles.resultsCountText} testID="discover-results-count">
              {`${resultCount} result${resultCount === 1 ? '' : 's'}`}
              {locationLabel ? ` · ${locationLabel}` : ''}
            </Text>
            {activeFilterChips.length > 0 && (
              <View style={styles.activeChipsRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.activeChipsRowContent}
                >
                  {activeFilterChips.map((chip) => (
                    <View
                      key={chip.key}
                      testID={`active-filter-chip-${chip.key}`}
                      style={[
                        styles.activeChip,
                        chip.isSp ? styles.activeChipSp : styles.activeChipPrimary,
                      ]}
                    >
                      <Text
                        style={[
                          styles.activeChipText,
                          chip.isSp ? styles.activeChipTextSp : styles.activeChipTextPrimary,
                        ]}
                        numberOfLines={1}
                      >
                        {chip.label}
                      </Text>
                      <Pressable
                        testID={`remove-filter-${chip.key}`}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${chip.label} filter`}
                        onPress={() => handleRemoveFilter(chip.key)}
                        hitSlop={8}
                      >
                        <X
                          size={14}
                          color={chip.isSp ? ds.sp[500] : ds.primary[600]}
                          weight="bold"
                        />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Pressable
                  testID="clear-all-filters"
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                  onPress={handleClearAllActiveFilters}
                  hitSlop={8}
                >
                  <Text style={styles.clearAllChipText}>Clear all</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Network Error Banner */}
        {error && (
          <Pressable
            testID="network-error-banner"
            style={styles.errorBanner}
            onPress={handleRetry}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
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
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Search for ${suggestion}`}
                style={styles.autocompleteSuggestion}
                onPress={() => handleAutocompleteTap(suggestion)}
              >
                <Text style={styles.autocompleteSuggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* DISCOVER-REDESIGN: Recent Searches + Trending (below search bar, above grid) */}
        {showDiscoverySections && (
          <View style={styles.discoverySections}>
            {recentSearches.length > 0 && (
              <View style={styles.discoverySection} testID="recent-searches-panel">
                <View style={styles.discoverySectionHeader}>
                  <Text style={styles.discoverySectionTitle}>Recent Searches</Text>
                  <Pressable
                    testID="clear-recent-searches"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent searches"
                    onPress={handleClearAllRecentSearches}
                    hitSlop={8}
                  >
                    <Text style={styles.clearAllText}>Clear</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentChipsRow}
                >
                  {recentSearches.map((search, index) => (
                    <Pressable
                      key={`recent-${index}`}
                      testID={`recent-search-${index}`}
                      accessible
                      accessibilityRole="button"
                      style={styles.recentChip}
                      onPress={() => handleAutocompleteTap(search)}
                      accessibilityLabel={`Search for ${search}`}
                    >
                      <Text style={styles.recentChipText} numberOfLines={1}>
                        {search}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {trending.length > 0 && (
              <View style={styles.discoverySection} testID="trending-panel">
                <Text style={styles.discoverySectionTitle}>Trending in {userState}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingChipsRow}
                >
                  {trending.map((cat) => (
                    <Pressable
                      key={cat.category_id}
                      testID={`trending-chip-${cat.category_id}`}
                      accessible
                      accessibilityRole="button"
                      style={styles.trendingChip}
                      onPress={() => handleTrendingTap(cat)}
                      accessibilityLabel={`Browse trending category ${cat.category_name}`}
                    >
                      <Text style={styles.trendingChipText} numberOfLines={1}>
                        {cat.category_name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
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
              accessible
              accessibilityRole="button"
              accessibilityLabel="Clear Filters"
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
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Search for ${spellSuggestion}`}
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
        ) : userNodeId && !showAllNodes && !waitlisted && !/^\d{5}$/.test(appliedZipCode) ? (
          <>
            <Text style={styles.emptyTitle}>Nothing in your area yet</Text>
            <Text style={styles.emptySubtitle}>
              Items from your local community will show up here. Want to browse items from nearby
              communities?
            </Text>
            <Pressable
              testID="empty-show-all-nodes"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Show All Nodes"
              style={styles.clearFiltersButton}
              onPress={() => setShowAllNodes(true)}
            >
              <Text style={styles.clearFiltersText}>Show All Nodes</Text>
            </Pressable>
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* DISCOVER-REDESIGN: Discover-local header (shared AppHeader untouched) */}
      <DiscoverHeader />

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
        defaultRadiusMiles={defaultRadiusMiles}
        locationLoading={locationLoading}
        inactiveZipMessage={inactiveZipMessage}
        waitlistMessage={waitlistMessage}
        userProfileZip={sanitizeZipCode(session?.user?.zip_code || '')}
        currentQuery={debouncedQuery}
        spEligibleOnly={filters.spEligibleOnly === true}
        onSpToggle={handleToggleSpEligible}
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

            {inactiveZipDialog.step === 'consent' ? (
              <>
                <Text style={styles.inactiveZipModalMessage}>
                  We're not live in ZIP {inactiveZipDialog.zip} yet. Would you like us to let you
                  know when we launch here?
                </Text>

                <View style={styles.inactiveZipModalActionsColumn}>
                  <Pressable
                    style={styles.inactiveZipConsentPrimaryButton}
                    onPress={handleWaitlistOptInYes}
                    testID="inactive-zip-waitlist-yes"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Yes, add me to the waitlist"
                  >
                    <Text style={styles.inactiveZipPrimaryButtonText}>
                      Yes, Add Me to the Waitlist
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.inactiveZipConsentSecondaryButton}
                    onPress={handleWaitlistOptInNo}
                    testID="inactive-zip-waitlist-no"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="No, thanks"
                  >
                    <Text style={styles.inactiveZipSecondaryButtonText}>No, Thanks</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.inactiveZipModalMessage}>{inactiveZipOutcomeMessage()}</Text>

                <View style={styles.inactiveZipModalActions}>
                  <Pressable
                    style={styles.inactiveZipSecondaryButton}
                    onPress={handleInactiveZipBackToFilters}
                    testID="inactive-zip-back-to-filters"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Back to Filters"
                  >
                    <Text style={styles.inactiveZipSecondaryButtonText}>Back to Filters</Text>
                  </Pressable>

                  <Pressable
                    style={styles.inactiveZipPrimaryButton}
                    onPress={handleInactiveZipSeeAllResults}
                    testID="inactive-zip-see-all-results"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="See All Results"
                  >
                    <Text style={styles.inactiveZipPrimaryButtonText}>See All Results</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </RNModal>
    </SafeAreaView>
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
    borderRadius: dsRadii.pill,
    borderWidth: 1,
    borderColor: ds.sp[500],
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    backgroundColor: ds.neutral.white,
  },
  spQuickToggleActive: {
    backgroundColor: ds.sp[100],
  },
  spQuickToggleText: {
    ...dsType.label,
    color: ds.sp[500],
  },
  spQuickToggleTextActive: {
    color: ds.sp[500],
    fontWeight: '700',
  },
  // Fix 4: Free-user SP upgrade CTA — mirrors ItemCreateScreen's
  // spUpgradePrompt block (AUTH-TC-J07) so the free-tier SP restriction CTA is
  // visually identical app-wide. Colors intentionally match that pattern
  // (amber tint + brand-green button); #7A5A2A is the amber prompt text from
  // the ItemCreate pattern (not in the passitup token set).
  spUpgradePrompt: {
    marginTop: 12,
    backgroundColor: ds.sp[100],
    borderRadius: dsRadii.medium,
    padding: 12,
  },
  spUpgradeText: {
    ...dsType.body,
    color: '#7A5A2A',
    marginBottom: 10,
  },
  spUpgradeButton: {
    backgroundColor: ds.primary[500],
    borderRadius: dsRadii.pill,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  spUpgradeButtonText: {
    ...dsType.label,
    fontWeight: '600',
    color: ds.neutral.white,
  },
  showAllNodesRow: {
    marginTop: 12,
  },
  showAllNodesToggle: {
    alignSelf: 'flex-start',
    height: 36,
    borderRadius: dsRadii.pill,
    borderWidth: 1,
    borderColor: ds.neutral[300],
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ds.neutral.white,
  },
  showAllNodesToggleActive: {
    backgroundColor: ds.primary[100],
    borderColor: ds.primary[400],
  },
  showAllNodesToggleText: {
    ...dsType.label,
    color: ds.neutral[700],
  },
  showAllNodesToggleTextActive: {
    color: ds.primary[600],
    fontWeight: '700',
  },
  showAllNodesToggleHint: {
    ...dsType.bodySmall,
    color: ds.neutral[500],
    marginLeft: 4,
  },
  resultsSummary: {
    marginTop: 12,
    gap: 8,
  },
  resultsCountText: {
    ...dsType.bodySmall,
    color: ds.neutral[700],
  },
  activeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeChipsRowContent: {
    gap: 8,
    paddingRight: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: dsRadii.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
  },
  activeChipPrimary: {
    backgroundColor: ds.primary[100],
    borderColor: ds.primary[400],
  },
  activeChipSp: {
    backgroundColor: ds.sp[100],
    borderColor: ds.sp[500],
  },
  activeChipText: {
    ...dsType.label,
    flexShrink: 1,
  },
  activeChipTextPrimary: {
    color: ds.primary[600],
  },
  activeChipTextSp: {
    color: ds.sp[500],
  },
  clearAllChipText: {
    ...dsType.label,
    color: ds.primary[600],
  },
  discoverySections: {
    marginTop: 12,
    gap: 16,
  },
  discoverySection: {
    gap: 8,
  },
  discoverySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discoverySectionTitle: {
    ...dsType.body,
    fontWeight: '600',
    color: ds.neutral[900],
  },
  recentChipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  recentChip: {
    backgroundColor: ds.neutral[100],
    borderRadius: dsRadii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recentChipText: {
    ...dsType.bodySmall,
    color: ds.neutral[700],
  },
  trendingChipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  trendingChip: {
    backgroundColor: ds.primary[100],
    borderRadius: dsRadii.pill,
    borderWidth: 1,
    borderColor: ds.primary[400],
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trendingChipText: {
    ...dsType.bodySmall,
    color: ds.primary[600],
    fontWeight: '600',
  },
  clearAllText: {
    ...dsType.label,
    color: ds.primary[600],
  },
  listContent: {
    padding: 16,
    // Bottom inset for the floating tab bar: without it the last row's lower
    // content (badge/price) renders behind the tab bar in short result sets
    // (e.g. single-item search with Show All Nodes on). tabBarHeight + page pad.
    paddingBottom: componentSize.tabBarHeight + spacing.md,
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
  // 2026-08-22: consent step uses full-width stacked buttons (longer labels
  // than the two navigation buttons in the outcome step).
  inactiveZipModalActionsColumn: {
    marginTop: 24,
    gap: 12,
  },
  inactiveZipConsentSecondaryButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#C9C9C9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inactiveZipConsentPrimaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
