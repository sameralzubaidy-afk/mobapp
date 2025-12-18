/**
 * File: p2p-kids-marketplace/src/screens/items/BrowseItemsScreen.tsx
 * MODULE-03 NODE-006: Node-Specific Item Filtering
 * 
 * Browse items screen with node-based filtering:
 * - Shows items from user's node by default
 * - Toggle to show items from all nodes
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
import { getItems, type Item, type ItemFilters } from '@/services/items';

export default function BrowseItemsScreen() {
  const { user } = useUserStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllNodes, setShowAllNodes] = useState(false);

  useEffect(() => {
    loadItems();
  }, [showAllNodes]);

  const loadItems = async (isRefreshing = false) => {
    if (!user) {
      console.warn('⚠️ User not loaded yet');
      return;
    }

    if (!isRefreshing) {
      setLoading(true);
    }

    try {
      const filters: ItemFilters = {
        node_id: user.node_id || undefined,
        include_all_nodes: showAllNodes,
      };

      console.log('🔍 Loading items with filters:', filters);

      const data = await getItems(filters, user.id);
      setItems(data);
      
      console.log(`✅ Loaded ${data.length} items`);
    } catch (error) {
      console.error('❌ Load items error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadItems(true);
  };

  const renderHeader = () => (
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
  );

  const renderItem = ({ item }: { item: Item }) => {
    const isOtherNode = showAllNodes && item.seller?.node_id !== user?.node_id;
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

          {/* NODE-006: Seller Node Info */}
          <View style={styles.nodeInfo}>
            <Text style={styles.nodeText}>
              📍 {item.seller?.node?.name || 'Unknown Node'}
            </Text>
            {isOtherNode && (
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
