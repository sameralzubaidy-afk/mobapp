/**
 * File: p2p-kids-marketplace/src/screens/cart/BundleBuilderScreen.tsx
 * MODULE-15.1-UI-REDESIGN: Bundle Builder Screen
 * Task: FLOW-07 Cart & Bundling - Bundle Builder View
 *
 * Redesigned with Whisk design system and Phosphor icons.
 * Features:
 * - "Build a Bundle" heading and subtext
 * - 2-column item grid with Plus overlay (unselected)
 * - CheckCircle overlay (green) on selected items
 * - Bundle summary bar with item count, total, savings badge
 * - Green pill "Add to Cart" button
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Alert
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/ui';
import { theme } from '@/theme';
import {
  Plus,
  CheckCircle,
  Tag,
} from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type BundleBuilderRouteProp = RouteProp<RootStackParamList, 'BundleBuilder'>;

interface BundleItem {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  condition: string;
}

export default function BundleBuilderScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BundleBuilderRouteProp>();
  const { sellerId, sellerName: _sellerName } = route.params;

  const [availableItems, setAvailableItems] = useState<BundleItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSellerItems();
  }, [sellerId]);

  const loadSellerItems = async () => {
    try {
      setLoading(true);
      // TODO: Load seller's available items from Supabase
      // For now, show empty list
      setAvailableItems([]);
    } catch (error) {
      console.error('[BundleBuilderScreen] Load error:', error);
      Alert.alert('Error', 'Failed to load seller items');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const calculateBundleTotal = () => {
    return availableItems
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.price, 0);
  };

  const calculateSavings = () => {
    const selectedCount = selectedItems.size;
    if (selectedCount < 2) return 0;
    
    // Example bundle discount: 10% off for 2+ items, 15% off for 3+ items
    const discountPercent = selectedCount >= 3 ? 15 : 10;
    const total = calculateBundleTotal();
    return (total * discountPercent) / 100;
  };

  const getSavingsPercentage = () => {
    const selectedCount = selectedItems.size;
    if (selectedCount < 2) return 0;
    return selectedCount >= 3 ? 15 : 10;
  };

  const handleAddToCart = () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to add to your bundle');
      return;
    }

    // TODO: Add bundle to cart
    Alert.alert(
      'Bundle Added',
      `${selectedItems.size} item(s) added to your trade basket with ${getSavingsPercentage()}% discount!`,
      [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]
    );
  };

  const _handleClose = () => {
    if (selectedItems.size > 0) {
      Alert.alert(
        'Discard Bundle?',
        'Are you sure you want to discard your bundle selection?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const renderItem = ({ item }: { item: BundleItem }) => {
    const isSelected = selectedItems.has(item.id);

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => toggleItemSelection(item.id)}
        testID={`bundle-item-${item.id}`}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.itemImage}
          testID={`bundle-item-image-${item.id}`}
        />
        
        {/* Selection Overlay */}
        {isSelected && (
          <View style={styles.selectedOverlay} testID={`bundle-item-selected-${item.id}`}>
            <CheckCircle size={32} color={theme.colors.primary[500]} weight="fill" />
          </View>
        )}

        {/* Plus Overlay (unselected) */}
        {!isSelected && (
          <View style={styles.unselectedOverlay}>
            <View style={styles.plusCircle}>
              <Plus size={20} color={theme.textColors.onPrimary} weight="bold" />
            </View>
          </View>
        )}

        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.itemPrice} testID={`bundle-item-price-${item.id}`}>
            ${item.price.toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Build Offer">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Build Offer">
      {/* Items Grid */}
      {availableItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Tag size={64} color={theme.colors.neutral[300]} weight="regular" />
          <Text style={styles.emptyTitle}>No More Items Available</Text>
          <Text style={styles.emptySubtext}>
            This seller doesn't have any other items available for bundling
          </Text>
        </View>
      ) : (
        <FlatList
          data={availableItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          testID="bundle-items-grid"
        />
      )}

      {/* Sticky Summary Bar */}
      {selectedItems.size > 0 && (
        <View style={styles.summaryBar} testID="bundle-summary-bar">
          <View style={styles.summaryLeft}>
            <Text style={styles.itemCountChip} testID="bundle-item-count">
              {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'}
            </Text>
            
            {getSavingsPercentage() > 0 && (
              <View style={styles.savingsBadge} testID="bundle-savings-badge">
                <Text style={styles.savingsText}>
                  Save {getSavingsPercentage()}%
                </Text>
              </View>
            )}
          </View>

          <View style={styles.summaryRight}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue} testID="bundle-total">
                ${(calculateBundleTotal() - calculateSavings()).toFixed(2)}
              </Text>
              {calculateSavings() > 0 && (
                <Text style={styles.originalPrice} testID="bundle-original-price">
                  ${calculateBundleTotal().toFixed(2)}
                </Text>
              )}
            </View>

            <Button
              variant="primary"
              size="medium"
              onPress={handleAddToCart}
              style={styles.addButton}
              testID="bundle-add-to-cart-button"
            >
              Add to Cart
            </Button>
          </View>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },

  headerContent: {
    flex: 1,
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },

  backButtonText: {
    fontSize: 28,
    color: '#5DBB8E',
  },

  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: theme.spacing.xs,
  },

  subtext: {
    fontSize: 15,
    color: theme.textColors.secondary,
    lineHeight: 22,
  },

  closeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },

  gridContent: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.md,
    paddingBottom: 120,
  },

  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },

  itemCard: {
    width: '48%',
    backgroundColor: theme.backgroundColors.card,
    borderRadius: 8,
    overflow: 'hidden',
    ...theme.shadows.level1,
  },

  itemImage: {
    width: '100%',
    height: 140,
    backgroundColor: theme.colors.neutral[100],
  },

  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(93, 187, 142, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },

  unselectedOverlay: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },

  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemDetails: {
    padding: theme.spacing.sm,
  },

  itemTitle: {
    ...theme.typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: theme.spacing.xs,
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.primary,
  },

  summaryBar: {
    position: 'absolute',
    // Clear the floating pill nav (PersistentTabBar now overlays the stack
    // content): pill top sits ~110pt from the bottom (safe-area + spacing.sm +
    // pill height), so the sticky summary bar must sit above it.
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.backgroundColors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
    ...theme.shadows.level2,
  },

  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  itemCountChip: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.primary,
    backgroundColor: theme.colors.neutral[100],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
  },

  savingsBadge: {
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },

  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary[500],
  },

  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },

  totalContainer: {
    alignItems: 'flex-end',
  },

  totalLabel: {
    fontSize: 12,
    color: theme.textColors.secondary,
  },

  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColors.primary,
  },

  originalPrice: {
    fontSize: 12,
    color: theme.textColors.tertiary,
    textDecorationLine: 'line-through',
  },

  addButton: {
    paddingHorizontal: theme.spacing.lg,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    ...theme.typography.h2,
    color: theme.textColors.primary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },

  emptySubtext: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
    textAlign: 'center',
  },
});
