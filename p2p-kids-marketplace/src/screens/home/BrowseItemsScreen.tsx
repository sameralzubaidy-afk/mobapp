// File: p2p-kids-marketplace/src/screens/home/BrowseItemsScreen.tsx
// MODULE-03 NODE-006: Node-Specific Item Filtering
// MODULE-03 NODE-007: Distance Radius Filter
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  SafeAreaView,
  RefreshControl,
  Switch,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useUserStore } from '@/stores/userStore';
import { getItems, getItemsWithinRadius, getCategories, Item } from '@/services/items';
import { searchListings, searchListingsByCategoryAndQuery } from '@/services/discovery';
import { supabase } from '@/config/supabase';
import { calculateDistanceBetweenNodes, getUserPreferredRadius, saveUserPreferredRadius } from '@/services/location';
import { trackEvent } from '@/services/analytics';
import RadiusSlider from '@/components/RadiusSlider';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BottomNavBar from '@/components/organisms/BottomNavBar';

type NavigationProp = NativeStackNavigationProp<any>;


interface Category {
  id: string;
  name: string;
  icon: string;
}

export default function BrowseItemsScreen() {
  const { user, setUser } = useUserStore();
  const navigation = useNavigation<NavigationProp>();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // MODULE-04 LISTING-V2-004: SP-eligible filter toggle
  const [spEligibleOnly, setSpEligibleOnly] = useState(false);

  // DISCOVERY-V2-001: Search functionality
  // inputText: updates immediately on each keystroke (for TextInput display)
  // searchQuery: only updates after debounce completes (for actual search logic)
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // NODE-007: Radius filter state
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [minRadius, setMinRadius] = useState(5);
  const [maxRadius, setMaxRadius] = useState(25);
  const [allowRadiusAdjustment, setAllowRadiusAdjustment] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [itemsWithDistance, setItemsWithDistance] = useState<Map<string, number>>(new Map());
  const [loadingDistances, setLoadingDistances] = useState(false);

  // Load user from auth if not in store
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        // If user not in store, fetch from profiles table
        if (!user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .single();

          if (profileError) {
            console.error('Error loading profile:', profileError);
            setError('Failed to load user profile');
            setLoading(false);
            return;
          }

          if (profile && profile.node_id) {
            // Fetch node data separately
            const { data: nodeData } = await supabase
              .from('nodes')
              .select('id, name, city, state, latitude, longitude')
              .eq('id', profile.node_id)
              .single();

            // Map database fields to store format
            const userData = {
              id: profile.user_id,
              email: profile.email || authUser.email || '',
              name: profile.name || '',
              avatar_url: profile.avatar_url || '',
              node_id: profile.node_id,
              node: nodeData || undefined,
            };
            setUser(userData);
          } else if (profile) {
            // Profile exists but no node assigned
            const userData = {
              id: profile.user_id,
              email: profile.email || authUser.email || '',
              name: profile.name || '',
              avatar_url: profile.avatar_url || '',
              node_id: profile.node_id,
              node: undefined,
            };
            setUser(userData);
          }
        }

        setError(null);
      } catch (err) {
        console.error('Error in loadUser:', err);
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [user?.id, setUser]);

  // Items state is managed by loadItems and search handlers

  // Fetch categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };
    loadCategories();
  }, []);

  // NODE-007: Load radius settings on mount
  useEffect(() => {
    loadRadiusSettings();
    loadUserPreferredRadiusValue();
    
    // Cleanup: clear debounce timeout on unmount
    return () => {
      if (radiusChangeTimeoutRef.current) {
        clearTimeout(radiusChangeTimeoutRef.current);
        radiusChangeTimeoutRef.current = null;
      }
    };
  }, []);

  // NODE-007: Reload items when node toggle or category changes
  // MODULE-04 LISTING-V2-004: Also reload when SP filter changes
  // Do NOT reload on radiusMiles change - only on sliding complete
  // DISCOVERY-V2-001: Skip this effect if there's an active search (let search re-filter instead)
  useEffect(() => {
    // If user is actively searching, don't load browse items
    if (searchQuery.trim().length >= 3) {
      return;
    }

    (async () => {
      await loadItems();
    })();
  }, [showAllNodes, selectedCategory, spEligibleOnly, user?.node_id, searchQuery]);

  const loadRadiusSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', [
          'default_radius_miles',
          'min_user_radius_miles',
          'max_user_radius_miles',
          'allow_user_radius_adjustment',
        ]);

      if (error) {
        console.warn('Load radius settings RLS/query error:', error.message);
        setRadiusMiles(10);
        setMinRadius(5);
        setMaxRadius(25);
        setAllowRadiusAdjustment(true);
      } else if (data && data.length > 0) {
        const settings: any = {};
        data.forEach((item) => {
          const value = item.value;
          if (value === 'true' || value === 'false') {
            settings[item.key] = value === 'true';
          } else {
            settings[item.key] = Number(value);
          }
        });
        
        if (settings.default_radius_miles !== undefined) {
          setRadiusMiles(settings.default_radius_miles);
        }
        if (settings.min_user_radius_miles !== undefined) {
          setMinRadius(settings.min_user_radius_miles);
        }
        if (settings.max_user_radius_miles !== undefined) {
          setMaxRadius(settings.max_user_radius_miles);
        }
        if (settings.hasOwnProperty('allow_user_radius_adjustment')) {
          setAllowRadiusAdjustment(settings.allow_user_radius_adjustment);
        }
      } else {
        setRadiusMiles(10);
        setMinRadius(5);
        setMaxRadius(25);
        setAllowRadiusAdjustment(true);
      }
    } catch (error) {
      console.error('loadRadiusSettings exception:', error);
      setAllowRadiusAdjustment(true);
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadUserPreferredRadiusValue = async () => {
    try {
      if (!user?.id) return;
      const preferredRadius = await getUserPreferredRadius(user.id);
      if (preferredRadius) {
        setRadiusMiles(preferredRadius);
      }
    } catch (error) {
      console.error('❌ Error loading user preferred radius:', error);
    }
  };

  const radiusChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize loadItems so it can be used in other callbacks
  const loadItemsCallback = useCallback(async () => {
    await loadItems();
  }, []);

  const handleRadiusChange = useCallback(async (newRadius: number) => {
    try {
      if (!user?.id) return;
      
      // Update local state immediately (for UI)
      setRadiusMiles(newRadius);
      
      // Save to database immediately
      await saveUserPreferredRadius(user.id, newRadius);
      
      // Track analytics
      trackEvent('radius_adjusted', {
        user_id: user.id,
        new_radius_miles: newRadius,
        timestamp: new Date().toISOString(),
      });
      
      // DEBOUNCE items reload: clear old timeout and set new one
      // This means items will only reload after user stops adjusting for 300ms
      if (radiusChangeTimeoutRef.current) {
        clearTimeout(radiusChangeTimeoutRef.current);
      }
      
      radiusChangeTimeoutRef.current = setTimeout(async () => {
        await loadItems();
        radiusChangeTimeoutRef.current = null;
      }, 300); // 300ms debounce delay
      
    } catch (error) {
      console.error('❌ Error saving radius preference:', error);
    }
  }, [user?.id]);

  const calculateItemDistances = async (itemsToCalculate: Item[]) => {
    if (!user?.node_id || !showAllNodes) {
      setItemsWithDistance(new Map());
      return;
    }

    setLoadingDistances(true);
    const distanceMap = new Map<string, number>();

    try {
      for (const item of itemsToCalculate) {
        if (item.seller_node_id && item.seller_node_id !== user.node_id) {
          const distance = await calculateDistanceBetweenNodes(user.node_id, item.seller_node_id);
          if (distance) {
            distanceMap.set(item.id, distance);
          }
        }
      }
      setItemsWithDistance(distanceMap);
    } catch (error) {
      console.error('❌ Error calculating distances:', error);
    } finally {
      setLoadingDistances(false);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current auth user as fallback
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        setError('Not authenticated');
        setItems([]);
        setLoading(false);
        return;
      }

      // Use store user if available, otherwise need to fetch profile first
      const userId = user?.id || authUser.id;
      const nodeId = user?.node_id;

      if (!nodeId && !showAllNodes) {
        // If no node assigned and trying to show local items, show message
        setError('Your node is not assigned yet');
        setItems([]);
        setLoading(false);
        return;
      }

      const filters = {
        node_id: showAllNodes ? undefined : (nodeId ?? undefined),
        category_id: selectedCategory || undefined,
        accepts_swap_points: spEligibleOnly, // MODULE-04 LISTING-V2-004: SP filter
      };

      let fetchedItems: Item[] = [];
      
      // NODE-007: Use radius-based filtering if showing all nodes
      if (showAllNodes && radiusMiles > 0 && nodeId) {
        fetchedItems = await getItemsWithinRadius(nodeId, radiusMiles, userId);
      } else {
        fetchedItems = await getItems(filters, userId);
      }
      
      setItems(fetchedItems);
      
      // NODE-007: Calculate distances for cross-node items
      if (showAllNodes) {
        await calculateItemDistances(fetchedItems);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const renderItemCard = ({ item }: { item: Item }) => {
    const isOtherNode = showAllNodes && item.seller_node_id !== user?.node_id;

    return (
      <TouchableOpacity
        style={{
          flex: 1,
          margin: 8,
          backgroundColor: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }}
        onPress={() => navigation.navigate('ListingDetail', { listing_id: item.id })}
      >
        {/* Image */}
        <View
          style={{
            width: '100%',
            height: 150,
            backgroundColor: '#f0f0f0',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#999', fontSize: 12 }}>📷 No Image</Text>
        </View>

        {/* Content */}
        <View style={{ padding: 12 }}>
          {/* Badges */}
          <View style={{ flexDirection: 'row', marginBottom: 8, gap: 6 }}>
            {isOtherNode && (
              <View
                style={{
                  backgroundColor: '#ffd700',
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: '#333', fontWeight: '600' }}>
                  Other Node
                </Text>
              </View>
            )}
            {item.accepts_swap_points && (
              <View
                style={{
                  backgroundColor: '#e8f5e9',
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: '#2e7d32', fontWeight: '600' }}>
                  ⚡ SP Eligible
                </Text>
              </View>
            )}
            {/* NODE-007: Distance badge for cross-node items */}
            {isOtherNode && itemsWithDistance.get(item.id) !== undefined && (
              <View
                style={{
                  backgroundColor: '#bbdefb',
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: '#1976d2', fontWeight: '600' }}>
                  📍 {itemsWithDistance.get(item.id)?.toFixed(1)} mi
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: '#333',
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          {/* Price */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#007AFF',
              marginBottom: 4,
            }}
          >
            ${item.price.toFixed(2)}
          </Text>

          {/* Node Name (if cross-node) */}
          {isOtherNode && (
            <Text style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
              📍 {item.seller?.node?.name || 'Unknown Node'}
            </Text>
          )}

          {/* Condition */}
          <Text style={{ fontSize: 11, color: '#999' }}>
            {item.condition ? item.condition.charAt(0).toUpperCase() + item.condition.slice(1) : 'Good'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>
        No Items Found
      </Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 20 }}>
        {showAllNodes
          ? 'No items available in nearby nodes'
          : 'No items in your node yet. Try expanding your search!'}
      </Text>
    </View>
  );

  // DISCOVERY-V2-001: Handle text search with debounce (1000ms for better UX)
  const handleSearchChange = useCallback(async (query: string) => {
    // IMPORTANT: Only update inputText immediately (for visual feedback)
    // Don't update searchQuery here - that stays debounced
    setInputText(query);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If empty query, load normal items immediately
    if (!query.trim()) {
      setSearchQuery(''); // Update searchQuery state
      setItems([]); // Clear search results first
      try {
        await loadItems();
      } catch (error) {
        // Gracefully handle if node isn't assigned yet
        console.warn('[Search] Error loading items on clear:', error);
        setError(null); // Don't show error, just stay with empty list
      }
      return;
    }

    // DISCOVERY-V2-001: Minimum 3 characters required for search
    if (query.trim().length < 3) {
      setItems([]); // Clear results if less than 3 chars
      setError(null);
      return;
    }

    // Debounce search: 1000ms (wait 1 second after user stops typing before searching)
    searchTimeoutRef.current = setTimeout(async () => {
      // NOW update searchQuery (after debounce completes)
      setSearchQuery(query);

      try {
        setIsSearching(true);
        setError(null); // Clear any previous errors
        
        // DISCOVERY-V2-002: Use category-filtered search if category selected, otherwise full-text search
        let results;
        if (selectedCategory) {
          // Search WITHIN the selected category
          results = await searchListingsByCategoryAndQuery(selectedCategory, query.trim(), {
            spEligibleOnly,
            limit: 20,
          });
        } else {
          // Full-text search across all categories
          results = await searchListings(query.trim(), {
            spEligibleOnly,
            limit: 20,
          });
        }
        
        // Safety check: Filter results client-side to ensure they match
        // This ensures the query is in title, description, or category (substring matching)
        const queryLower = query.trim().toLowerCase();
        const filteredResults = results.filter(item => {
          const title = (item.title || '').toLowerCase();
          const description = (item.description || '').toLowerCase();
          
          // Must have the search term as a substring in title or description
          const matchesQuery = title.includes(queryLower) || description.includes(queryLower);
          
          // Must match SP filter if enabled
          const matchesSP = !spEligibleOnly || item.accepts_swap_points;
          
          return matchesQuery && matchesSP;
        });
        
        // Map SearchResult to Item
        const itemsWithRelevance: Item[] = filteredResults.map(result => {
          const item: Item = {
            id: result.id,
            seller_id: result.seller_id,
            title: result.title,
            description: result.description,
            price: result.price,
            category_id: result.category_id,
            condition: result.condition,
            status: result.status,
            accepts_swap_points: result.accepts_swap_points,
            created_at: result.created_at,
            updated_at: (result as any).updated_at || result.created_at,
            sold_at: (result as any).sold_at || null,
            relevance: (result as any).relevance,
            seller_node_id: (result as any).seller_node_id,
          };
          return item;
        });
        
        setItems(itemsWithRelevance);
        
        trackEvent('search_performed', {
          query: query.substring(0, 100), // PII-safe truncation
          result_count: filteredResults.length,
          sp_filter: spEligibleOnly,
        });
      } catch (error) {
        console.error('[searchListings] Error:', error);
        setError('Search failed. Try browsing instead.');
        setItems([]); // Clear items on error
      } finally {
        setIsSearching(false);
      }
    }, 1000); // 1000ms (1 second) debounce delay - waits longer for user to finish typing
  }, [spEligibleOnly]);

  // DISCOVERY-V2-001: Re-run search when SP filter toggle changes
  // This ensures the server-side search respects the new filter
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      // No active search, skip
      return;
    }

    // Re-run the search with the new spEligibleOnly value
    (async () => {
      try {
        setIsSearching(true);
        setError(null);
        
        // DISCOVERY-V2-002: Use category-filtered search if category selected
        let results;
        if (selectedCategory) {
          results = await searchListingsByCategoryAndQuery(selectedCategory, searchQuery.trim(), {
            spEligibleOnly,
            limit: 20,
          });
        } else {
          results = await searchListings(searchQuery.trim(), {
            spEligibleOnly,
            limit: 20,
          });
        }
        
        // Safety check: Filter results client-side to ensure they match
        const queryLower = searchQuery.trim().toLowerCase();
        const filteredResults = results.filter(item => {
          const title = (item.title || '').toLowerCase();
          const description = (item.description || '').toLowerCase();
          
          // Must have the search term as a substring in title or description
          const matchesQuery = title.includes(queryLower) || description.includes(queryLower);
          
          // Must match SP filter if enabled
          const matchesSP = !spEligibleOnly || item.accepts_swap_points;
          
          return matchesQuery && matchesSP;
        });
        
        // Map SearchResult to Item, explicitly preserving relevance score
        const itemsWithRelevance: Item[] = filteredResults.map(result => ({
          ...result,
          relevance: (result as any).relevance,
        } as Item));
        
        setItems(itemsWithRelevance);
      } catch (error) {
        console.error('[Search] Error during SP filter toggle:', error);
        setError('Search failed');
        setItems([]);
      } finally {
        setIsSearching(false);
      }
    })();
  }, [spEligibleOnly, searchQuery, selectedCategory]);

  /*
  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator testID="loading-indicator" size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }
  */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 12 }}>
          Browse Items
        </Text>

        {/* DISCOVERY-V2-001: Search Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔎</Text>
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: '#333',
              padding: 0,
            }}
            placeholder="Search items..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={handleSearchChange}
            editable={!isSearching}
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />
          )}
        </View>

        {/* Node Filter Toggle */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f0f0f0',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: '#666', fontWeight: '600' }}>
              {showAllNodes 
                ? 'All Nodes' 
                : user?.node?.name 
                  ? `My Node: ${user.node.name}, ${user.node.city || 'City'}, ${user.node.state || 'State'}`
                  : 'My Node: Loading...'}
            </Text>
          </View>
          <Switch
            value={showAllNodes}
            onValueChange={setShowAllNodes}
            trackColor={{ false: '#ddd', true: '#81c784' }}
            thumbColor={showAllNodes ? '#4caf50' : '#f1f1f1'}
          />
        </View>

        {/* NODE-007: Radius Slider */}
        {showAllNodes && allowRadiusAdjustment && !loadingSettings && (
          <RadiusSlider
            value={radiusMiles}
            minRadius={minRadius}
            maxRadius={maxRadius}
            onValueChange={setRadiusMiles}
            onSlidingComplete={handleRadiusChange}
            loading={loadingDistances}
          />
        )}

        {/* MODULE-04 LISTING-V2-004: SP-Eligible Filter Toggle */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f0f9ff',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            marginTop: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: '#0369a1', fontWeight: '600' }}>
              ⚡ Show only SP-eligible listings
            </Text>
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              {spEligibleOnly ? 'Showing items that accept Swap Points' : 'Showing all items'}
            </Text>
          </View>
          <Switch
            testID="sp-eligible-switch"
            value={spEligibleOnly}
            onValueChange={setSpEligibleOnly}
            trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
            thumbColor={spEligibleOnly ? '#1d4ed8' : '#f1f5f9'}
          />
        </View>

        {/* Category Filter */}
        {categories.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 8 }}>
              Categories
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: selectedCategory === null ? '#007AFF' : '#e0e0e0',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: selectedCategory === null ? '#fff' : '#333',
                    fontWeight: '600',
                  }}
                >
                  All
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: selectedCategory === cat.id ? '#007AFF' : '#e0e0e0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: selectedCategory === cat.id ? '#fff' : '#333',
                      fontWeight: '600',
                    }}
                  >
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={{ backgroundColor: '#ffebee', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: '#c62828', fontSize: 12 }}>Error: {error}</Text>
        </View>
      )}

      {/* Items Grid */}
      {items.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={items}
          renderItem={renderItemCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 4 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Unified Navigation Bar */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
