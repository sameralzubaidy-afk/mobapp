/**
 * File: p2p-kids-marketplace/src/screens/items/BrowseItemsScreen.tsx
 * MODULE-03 NODE-006: Node-Specific Item Filtering
 * MODULE-03 NODE-007: Distance Radius Filter
 * 
 * Browse items screen with node-based filtering:
 * - Shows items from user's node by default
 * - Toggle to show items from all nodes
 * - NODE-007: Adjustable search radius (5-25 miles)
 * - Distance display for items from other nodes
 * - Badge for items from other nodes
 * - Empty state when no items available
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Image,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useUserStore } from '@/stores/userStore';
import { supabase } from '@/services/supabase';
import { getItems, getItemsWithinRadius, type Item, type ItemFilters } from '@/services/items';
import { calculateDistanceBetweenNodes, getUserPreferredRadius, saveUserPreferredRadius } from '@/services/location';
import { trackEvent } from '@/services/analytics';
import RadiusSlider from '@/components/RadiusSlider';

export default function BrowseItemsScreen() {
  const { user } = useUserStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllNodes, setShowAllNodes] = useState(false);
  
  // NODE-007: Radius filter state
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [minRadius, setMinRadius] = useState(5);
  const [maxRadius, setMaxRadius] = useState(25);
  const [allowRadiusAdjustment, setAllowRadiusAdjustment] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [itemsWithDistance, setItemsWithDistance] = useState<Map<string, number>>(new Map());
  const [loadingDistances, setLoadingDistances] = useState(false);

  useEffect(() => {
    console.log('🔵 BrowseItemsScreen mounted - calling loadRadiusSettings');
    console.warn('🔵🔵🔵 BrowseItemsScreen MOUNTED 🔵🔵🔵');
    loadRadiusSettings();
    loadUserPreferredRadiusValue();
  }, []);

  useEffect(() => {
    loadItems();
  }, [showAllNodes, radiusMiles]);

  const loadRadiusSettings = async () => {
    console.log('🟡 loadRadiusSettings started');
    try {
      console.log('🟡 Querying admin_config table...');
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', [
          'default_radius_miles',
          'min_user_radius_miles',
          'max_user_radius_miles',
          'allow_user_radius_adjustment',
        ]);

      console.log('🟡 Query returned. Error:', error);
      console.log('🟡 Query returned. Data length:', data?.length);

      if (error) {
        console.warn('⚠️ Load radius settings RLS/query error:', error.message);
        console.warn('ℹ️ Using hardcoded defaults (admin_config query blocked)');
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

        console.log('✅ Radius settings loaded from admin_config:', settings);
        
        if (settings.default_radius_miles !== undefined) {
          console.log('  → Setting default radius:', settings.default_radius_miles);
          setRadiusMiles(settings.default_radius_miles);
        }
        if (settings.min_user_radius_miles !== undefined) {
          console.log('  → Setting min radius:', settings.min_user_radius_miles);
          setMinRadius(settings.min_user_radius_miles);
        }
        if (settings.max_user_radius_miles !== undefined) {
          console.log('  → Setting max radius:', settings.max_user_radius_miles);
          setMaxRadius(settings.max_user_radius_miles);
        }
        if (settings.hasOwnProperty('allow_user_radius_adjustment')) {
          console.log('  → Setting allow adjust:', settings.allow_user_radius_adjustment);
          setAllowRadiusAdjustment(settings.allow_user_radius_adjustment);
        }
      } else {
        console.warn('ℹ️ No admin_config settings found - using hardcoded defaults');
        setRadiusMiles(10);
        setMinRadius(5);
        setMaxRadius(25);
        setAllowRadiusAdjustment(true);
      }
    } catch (error) {
      console.error('❌ loadRadiusSettings exception:', error);
      console.warn('ℹ️ Using hardcoded defaults due to exception');
      setAllowRadiusAdjustment(true);
    } finally {
      console.log('🟢 loadRadiusSettings finished - setting loadingSettings=false');
      setLoadingSettings(false);
    }
  };

  const loadUserPreferredRadiusValue = async () => {
    if (!user?.id) return;

    try {
      const preferred = await getUserPreferredRadius(user.id);
      setRadiusMiles(preferred);
      console.log(`✅ User preferred radius loaded: ${preferred} miles`);
    } catch (error) {
      console.warn('⚠️ Load preferred radius error:', error);
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadiusMiles(newRadius);

    // Track radius adjustment event (NODE-007)
    trackEvent('radius_adjusted', {
      user_id: user.id,
      new_radius: newRadius,
      previous_radius: radiusMiles,
    });

    // Save user preference
    if (user?.id) {
      try {
        await saveUserPreferredRadius(user.id, newRadius);
        trackEvent('radius_adjusted', {
          user_id: user.id,
          new_radius: newRadius,
        });
      } catch (error) {
        console.error('❌ Save preferred radius error:', error);
      }
    }
  };

  const loadItems = async (isRefreshing = false) => {
    if (!user) {
      console.warn('⚠️ User not loaded yet');
      return;
    }

    if (!isRefreshing) {
      setLoading(true);
    }

    try {
      let data: Item[] = [];

      if (showAllNodes) {
        // NODE-007: Load items within radius
        if (user.node_id) {
          data = await getItemsWithinRadius(user.node_id, radiusMiles, user.id);
        }
      } else {
        // Load items from user's node only
        const filters: ItemFilters = {
          node_id: user.node_id || undefined,
          include_all_nodes: false,
        };
        data = await getItems(filters, user.id);
      }

      setItems(data);

      // Calculate distances for items from other nodes
      await calculateItemDistances(data);

      console.log(`✅ Loaded ${data.length} items`);
    } catch (error) {
      console.error('❌ Load items error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateItemDistances = async (itemsToCalculate: Item[]) => {
    if (!user?.node_id || !showAllNodes) {
      setItemsWithDistance(new Map());
      return;
    }

    setLoadingDistances(true);
    const distances = new Map<string, number>();

    for (const item of itemsToCalculate) {
      if (item.seller?.node_id && item.seller.node_id !== user.node_id) {
        try {
          const distance = await calculateDistanceBetweenNodes(user.node_id, item.seller.node_id);
          if (distance !== null) {
            distances.set(item.id, distance);
          }
        } catch (error) {
          console.warn(`⚠️ Distance calculation error for item ${item.id}:`, error);
        }
      }
    }

    setItemsWithDistance(distances);
    setLoadingDistances(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadItems(true);
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Browse Items</Text>
        
        {/* NODE-006: Node Filter Toggle */}
        <View style={styles.filterContainer}>
          <View style={styles.filterInfo}>
            <Text style={styles.filterTitle}>
              {showAllNodes ? 'All Nodes' : `My Node: ${user?.node?.name || 'Loading...'}`}
            </Text>
            <Text style={styles.filterSubtitle}>
              {showAllNodes
                ? 'Items from all communities'
                : `Items from ${user?.node?.city}, ${user?.node?.state}`}
            </Text>
          </View>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>
              {showAllNodes ? 'All' : 'Local'}
            </Text>
            <Switch
              value={showAllNodes}
              onValueChange={setShowAllNodes}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor="#fff"
              ios_backgroundColor="#d1d5db"
            />
          </View>
        </View>
      </View>

      {/* NODE-007: Radius Slider (show when viewing all nodes and if allowed) */}
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
      {showAllNodes && (
        <Text style={{ fontSize: 12, color: '#666', marginHorizontal: 16, marginVertical: 8 }}>
          DEBUG: allow={allowRadiusAdjustment} loading={loadingSettings} showAll={showAllNodes}
        </Text>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: Item }) => {
    const isOtherNode = showAllNodes && item.seller?.node_id !== user?.node_id;
    const distance = itemsWithDistance.get(item.id);
    const firstImage = item.images && item.images.length > 0 ? item.images[0] : null;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => {
          // TODO: Navigate to item details (MODULE-04)
          console.log('📦 Item pressed:', item.id);
        }}
      >
        {/* Item Image */}
        <View style={styles.imageContainer}>
          {firstImage ? (
            <Image
              source={{ uri: firstImage.thumbnail_url || firstImage.url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>📦</Text>
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.itemPrice}>
            ${item.price.toFixed(2)}
          </Text>

          {/* NODE-006 + NODE-007: Seller Node Info with Distance */}
          <View style={styles.nodeInfo}>
            <Text style={styles.nodeText}>
              📍 {item.seller?.node?.name || 'Unknown Node'}
            </Text>
            {isOtherNode && distance !== undefined && (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>
                  {distance.toFixed(1)} mi away
                </Text>
              </View>
            )}
            {isOtherNode && distance === undefined && (
              <View style={styles.otherNodeBadge}>
                <Text style={styles.otherNodeBadgeText}>Other Node</Text>
              </View>
            )}
          </View>

          {/* Swap Points Badge (MODULE-04) */}
          {item.accepts_swap_points && (
            <View style={styles.spBadge}>
              <Text style={styles.spBadgeText}>⚡ SP Eligible</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📦</Text>
      <Text style={styles.emptyStateTitle}>
        {showAllNodes ? 'No items available' : 'No items in your node yet'}
      </Text>
      <Text style={styles.emptyStateText}>
        {showAllNodes
          ? 'Be the first to list an item!'
          : 'Try toggling "Show All Nodes" to see items from nearby communities'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={items.length === 0 ? styles.emptyListContent : undefined}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterInfo: {
    flex: 1,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  filterSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  row: {
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  itemCard: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 48,
  },
  itemDetails: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 8,
  },
  nodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  nodeText: {
    fontSize: 11,
    color: '#666',
  },
  distanceBadge: {
    marginLeft: 6,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distanceBadgeText: {
    fontSize: 9,
    color: '#1e40af',
    fontWeight: '600',
  },
  otherNodeBadge: {
    marginLeft: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  otherNodeBadgeText: {
    fontSize: 9,
    color: '#92400e',
    fontWeight: '600',
  },
  spBadge: {
    marginTop: 6,
    backgroundColor: '#dbeafe',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  spBadgeText: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
});
