/**
 * Browse Items Screen (NODE-006)
 * Displays items filtered by user's assigned node
 * Supports toggling between node-only and all items views
 * Includes node badges and distance indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getItems, getItemsWithinRadius, calculateDistance } from '@/services/items';
import type { Item, ItemFilters, NodeInfo } from '@/types/item.types';

// TODO(UI): Replace with final design tokens once Figma specs available
const colors = {
  primary: '#007AFF',
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#CCCCCC',
  badge: '#FF9500',
  success: '#34C759',
};

interface BrowseItemsScreenProps {
  navigation?: any;
}

export default function BrowseItemsScreen({
  navigation,
}: BrowseItemsScreenProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [userNodeId, setUserNodeId] = useState<string | null>(null);
  const [userNode, setUserNode] = useState<NodeInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize user data (normally from AuthContext or user store)
  useEffect(() => {
    // TODO: Get user from AuthContext or user store
    const testUserId = 'user-test-123';
    const testNodeId = '550e8400-e29b-41d4-a716-446655440001'; // Norwalk UUID
    const testNode: NodeInfo = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Norwalk Central',
      city: 'Norwalk',
      state: 'CT',
      latitude: 41.1177,
      longitude: -73.4079,
      radius_miles: 10,
    };

    setUserId(testUserId);
    setUserNodeId(testNodeId);
    setUserNode(testNode);
  }, []);

  // Load items on mount and when filters change
  useFocusEffect(
    useCallback(() => {
      if (userNodeId) {
        loadItems();
      }
    }, [userNodeId, showAllNodes])
  );

  /**
   * Load items based on filter settings
   */
  const loadItems = async () => {
    if (!userId || !userNodeId) {
      setError('User not initialized');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const filters: ItemFilters = {
        node_id: userNodeId,
        include_all_nodes: showAllNodes,
      };

      const result = showAllNodes
        ? // Show all nodes - use larger radius
          await getItemsWithinRadius(userNodeId, 50, userId)
        : // Show only user's node
          await getItems(filters, userId);

      setItems(result.items);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load items';
      setError(message);
      console.error('❌ Load items error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle refresh (pull to refresh)
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadItems();
    } finally {
      setRefreshing(false);
    }
  }, [userId, userNodeId, showAllNodes]);

  /**
   * Handle node filter toggle
   */
  const handleToggleNodeFilter = (value: boolean) => {
    setShowAllNodes(value);
  };

  /**
   * Render item card with node badge for cross-node items
   */
  const renderItemCard = ({ item }: { item: Item }) => {
    const isCrossNode = showAllNodes && item.node_id !== userNodeId;
    const distance =
      isCrossNode &&
      item.node &&
      userNode &&
      item.node.latitude !== undefined &&
      item.node.longitude !== undefined
        ? calculateDistance(userNode, item.node as any)
        : null;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => navigation?.navigate('ItemDetailScreen', { itemId: item.id })}
      >
        {/* Item image placeholder */}
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>📦</Text>
          </View>
        </View>

        {/* Item info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={styles.itemPrice}>
            ${(item.price_cents / 100).toFixed(2)}
          </Text>

          {/* Seller info */}
          {item.seller && (
            <Text style={styles.sellerName}>
              by {item.seller.name || 'Unknown'}
            </Text>
          )}

          {/* Node badge for cross-node items */}
          {isCrossNode && item.node && (
            <View style={styles.badgeContainer}>
              <View style={styles.nodeBadge}>
                <Text style={styles.badgeText}>
                  {item.node.name}
                  {distance ? ` • ${distance.toFixed(1)} mi` : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Condition badge */}
          {item.condition && (
            <Text style={styles.conditionText}>
              {item.condition.replace('_', ' ').toUpperCase()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No items found</Text>
        <Text style={styles.emptySubtitle}>
          {showAllNodes
            ? 'Try adjusting your search radius'
            : 'No items available in your node yet'}
        </Text>
        {!showAllNodes && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setShowAllNodes(true)}
          >
            <Text style={styles.expandButtonText}>
              Show items from nearby nodes
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with node info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Browse Items</Text>
        {userNode && !loading && (
          <Text style={styles.nodeInfo}>
            📍 Your Node: {userNode.name || 'Loading...'}
          </Text>
        )}
      </View>

      {/* Filter controls */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Show all nodes</Text>
          <Switch
            style={styles.switch}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={showAllNodes ? colors.primary : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={handleToggleNodeFilter}
            value={showAllNodes}
            testID="node-filter-toggle"
          />
        </View>
        {showAllNodes && (
          <Text style={styles.filterHint}>
            Showing items from nearby communities
          </Text>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && !refreshing && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Items list */}
      {!loading && (
        <FlatList
          data={items}
          renderItem={renderItemCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  nodeInfo: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  switch: {
    marginLeft: 8,
  },
  filterHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#CC0000',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#CC0000',
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.card,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  itemCard: {
    flex: 0.5,
    marginHorizontal: 4,
    marginVertical: 4,
    backgroundColor: colors.card,
    borderRadius: 8,
    overflow: 'hidden',
    // TODO(UX): Add shadow styling once design tokens finalized
  },
  imageContainer: {
    height: 140,
    backgroundColor: colors.background,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  placeholderText: {
    fontSize: 48,
  },
  itemInfo: {
    padding: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  badgeContainer: {
    marginVertical: 4,
  },
  nodeBadge: {
    backgroundColor: colors.badge,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.card,
  },
  conditionText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  expandButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.card,
  },
});
