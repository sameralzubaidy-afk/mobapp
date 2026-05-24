/**
 * File: p2p-kids-marketplace/src/screens/cart/CartScreen.tsx
 * MODULE-15.1-UI-REDESIGN: Cart Screen
 * Task: FLOW-07 Cart & Bundling - Cart View
 *
 * Redesigned with Whisk design system and Phosphor icons.
 * Features:
 * - Cart header with ShoppingCart icon and item count badge
 * - Cart item rows with 72×72px thumbnail, Trash icon
 * - Quantity controls (filled chips with Plus/Minus)
 * - SP discount row with Coins icon
 * - Summary card with subtle shadow
 * - Green pill "Checkout" button (sticky bottom)
 * - Empty cart state with ShoppingCart icon
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/ui';
import { theme } from '@/theme';
import {
  ShoppingCart,
  Trash,
  Plus,
  Minus,
  Coins,
} from 'phosphor-react-native';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CartItem {
  id: string;
  listingId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string;
  sellerId: string;
}

export default function CartScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [spDiscount, setSpDiscount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCartItems();
  }, []);

  const loadCartItems = async () => {
    try {
      setLoading(true);
      // TODO: Load cart items from state/storage
      // For now, show empty cart
      setCartItems([]);
      setSpDiscount(0);
    } catch (error) {
      console.error('[CartScreen] Load error:', error);
      Alert.alert('Error', 'Failed to load cart items');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCartItems(prev => prev.filter(item => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleIncreaseQuantity = (itemId: string) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const handleDecreaseQuantity = (itemId: string) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === itemId && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before checkout');
      return;
    }
    // TODO: Navigate to checkout screen
    Alert.alert('Checkout', 'Checkout flow will be implemented in FLOW-08');
  };

  const handleBrowseItems = () => {
    navigation.navigate('Discover');
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - spDiscount);
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="My Cart" showBell={false}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
        <BottomNavBar />
      </ScreenLayout>
    );
  }

  if (cartItems.length === 0) {
    return (
      <ScreenLayout variant="detail" title="My Cart">

        <View style={styles.emptyContainer}>
          <ShoppingCart
            size={64}
            color={theme.colors.neutral[300]}
            weight="regular"
            testID="cart-empty-icon"
          />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>
            Start adding items you love to your cart
          </Text>
          <Button
            variant="primary"
            size="large"
            onPress={handleBrowseItems}
            style={styles.browseButton}
            testID="browse-items-button"
          >
            Browse Items
          </Button>
        </View>

        <BottomNavBar />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="My Cart">
      {/* Cart Items */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsList}>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.itemRow} testID={`cart-item-${item.id}`}>
              {/* Thumbnail */}
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.thumbnail}
                testID={`cart-item-image-${item.id}`}
              />

              {/* Item Info */}
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.itemPrice} testID={`cart-item-price-${item.id}`}>
                  ${item.price.toFixed(2)}
                </Text>

                {/* Quantity Controls */}
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    onPress={() => handleDecreaseQuantity(item.id)}
                    style={styles.qtyButton}
                    disabled={item.quantity <= 1}
                    testID={`cart-item-decrease-${item.id}`}
                  >
                    <Minus size={16} color={theme.textColors.primary} weight="bold" />
                  </TouchableOpacity>
                  
                  <Text style={styles.qtyText} testID={`cart-item-quantity-${item.id}`}>
                    {item.quantity}
                  </Text>
                  
                  <TouchableOpacity
                    onPress={() => handleIncreaseQuantity(item.id)}
                    style={styles.qtyButton}
                    testID={`cart-item-increase-${item.id}`}
                  >
                    <Plus size={16} color={theme.textColors.primary} weight="bold" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remove Button */}
              <TouchableOpacity
                onPress={() => handleRemoveItem(item.id)}
                style={styles.trashButton}
                testID={`cart-item-remove-${item.id}`}
              >
                <Trash size={20} color={theme.colors.error[500]} weight="regular" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard} testID="cart-summary">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue} testID="cart-subtotal">
              ${calculateSubtotal().toFixed(2)}
            </Text>
          </View>

          {spDiscount > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.spRow}>
                <Coins size={16} color={theme.colors.accent[500]} weight="regular" />
                <Text style={styles.spLabel}>SP Discount</Text>
              </View>
              <Text style={styles.spValue} testID="cart-sp-discount">
                –${spDiscount.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue} testID="cart-total">
              ${calculateTotal().toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Checkout Button */}
      <View style={styles.stickyBottomContainer}>
        <Button
          variant="primary"
          size="large"
          onPress={handleCheckout}
          testID="checkout-button"
        >
          Checkout
        </Button>
      </View>

      <BottomNavBar />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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

  headerSpacer: {
    width: 36,
  },

  headerTitle: {
    ...theme.typography.h2,
    color: theme.textColors.primary,
  },

  itemCountBadge: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textColors.onPrimary,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 100,
  },

  itemsList: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.md,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[100],
  },

  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: theme.colors.neutral[100],
  },

  itemInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },

  itemTitle: {
    ...theme.typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: theme.spacing.xs,
  },

  itemPrice: {
    fontSize: 15,
    color: theme.textColors.primary,
    marginBottom: theme.spacing.sm,
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    gap: theme.spacing.sm,
    alignSelf: 'flex-start',
  },

  qtyButton: {
    padding: 4,
  },

  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textColors.primary,
    minWidth: 20,
    textAlign: 'center',
  },

  trashButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },

  summaryCard: {
    backgroundColor: theme.backgroundColors.card,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginHorizontal: 24,
    marginTop: theme.spacing.lg,
    ...theme.shadows.level1,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },

  summaryLabel: {
    ...theme.typography.body,
    color: theme.textColors.secondary,
  },

  summaryValue: {
    ...theme.typography.body,
    color: theme.textColors.primary,
  },

  spRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },

  spLabel: {
    ...theme.typography.body,
    color: theme.colors.accent[500],
  },

  spValue: {
    ...theme.typography.body,
    color: theme.colors.accent[500],
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.neutral[200],
    marginVertical: theme.spacing.sm,
  },

  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColors.primary,
  },

  totalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColors.primary,
  },

  stickyBottomContainer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
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
    marginBottom: theme.spacing.xl,
  },

  browseButton: {
    width: '100%',
    maxWidth: 300,
  },
});
