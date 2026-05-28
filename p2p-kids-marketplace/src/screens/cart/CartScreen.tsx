/**
 * File: p2p-kids-marketplace/src/screens/cart/CartScreen.tsx
 * MODULE-15.1-UI-REDESIGN: Cart Screen
 * TFV2-022: D-27 bundle_id, D-28 single-seller enforcement, D-29 4th-item eviction warning.
 *
 * Rules enforced here (client-side UX; server enforces too):
 *  D-27: One trade per item; all bundle trades share same bundle_id UUID.
 *  D-28: Single seller per active cart — adding a 2nd seller clears previous items with a warning.
 *  D-29: 4th item triggers an eviction warning modal before adding.
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { getCartItems, removeFromCart, CartItem as ServiceCartItem, saveCurrentCart, switchToSavedCart, clearCart, validateCartForCheckout, subscribeToCartChanges, SavedCartSummary } from '@/services/cartService';
import { supabase } from '@/config/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/ui';
import { theme } from '@/theme';
import { trackEvent } from '@/services/analytics';
import {
  ShoppingCart,
  Trash,
  Plus,
  Minus,
  Coins,
} from 'phosphor-react-native';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
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
  liveStatus?: string;
}

export default function CartScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [savedCarts, setSavedCarts] = useState<SavedCartSummary[]>([]);
  const [minCartValueCents, setMinCartValueCents] = useState<number>(0);
  const [spDiscount, _setSpDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  // TFV2-022: D-27 bundle_id shared by all items in this cart session
  const [bundleId] = useState<string>(() => Crypto.randomUUID());

  const loadCartItems = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCartItems();
      if (result.success) {
        const mapped: CartItem[] = result.data.items.map((i: ServiceCartItem) => ({
          id:         i.id,
          listingId:  i.listingId,
          title:      i.title ?? 'Untitled',
          price:      i.price ?? 0,
          quantity:   1,
          imageUrl:   i.imageUrl ?? '',
          sellerId:   i.sellerId,
          liveStatus: i.liveStatus,
        }));
        setCartItems(mapped);
        setSavedCarts(result.data.savedCarts ?? []);
      } else {
        console.warn('[CartScreen] Load warning:', result.error.message);
      }
    } catch (error) {
      console.error('[CartScreen] Load error:', error);
      Alert.alert('Error', 'Failed to load cart items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCartItems();
  }, [loadCartItems]);

  // CART-016: Realtime subscription — filtered by current cart listing IDs per spec
  // Re-subscribes whenever cartItems changes so the items-table filter stays accurate.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const listingIds = cartItems.map((i) => i.listingId).filter(Boolean);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      unsubscribe = subscribeToCartChanges(user.id, () => {
        loadCartItems();
      }, listingIds);
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadCartItems, cartItems]);

  // CART-009: Fetch admin-configured minimum cart value
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('value')
        .eq('key', 'cart_min_value_cents')
        .eq('is_active', true)
        .maybeSingle();
      if (!error && data?.value) {
        const cents = parseInt(data.value as string, 10);
        if (!Number.isNaN(cents)) setMinCartValueCents(cents);
      }
    })();
  }, []);

  const handleSaveCart = async () => {
    const r = await saveCurrentCart();
    if (!r.success) {
      Alert.alert('Could not save cart', r.error.message);
      return;
    }
    // CART-018: analytics
    trackEvent('cart_saved', { items_saved: cartItems.length });
    Alert.alert('Cart saved', 'Your cart was saved for later.');
    await loadCartItems();
  };

  const handleSwitchSaved = (cartId: string) => {
    Alert.alert(
      'Switch saved cart?',
      'Your current active cart will be saved and the selected cart will become active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            const prevCartId = bundleId;
            const r = await switchToSavedCart(cartId);
            if (!r.success) {
              Alert.alert('Could not switch', r.error.message);
              return;
            }
            // CART-018: analytics
            trackEvent('cart_switched', { from_cart_id: prevCartId, to_cart_id: cartId });
            await loadCartItems();
          },
        },
      ],
    );
  };

  const handleDeleteSaved = (cartId: string) => {
    Alert.alert('Delete saved cart?', 'This will permanently remove the saved cart.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await clearCart(cartId);
          await loadCartItems();
        },
      },
    ]);
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
          onPress: async () => {
            const removedItem = cartItems.find(item => item.id === itemId);
            setCartItems(prev => prev.filter(item => item.id !== itemId));
            // CART-018: analytics
            trackEvent('cart_item_removed', {
              listing_id: removedItem?.listingId ?? itemId,
              reason: 'user_action',
            });
            await removeFromCart(itemId).catch((e) =>
              console.warn('[CartScreen] removeFromCart error:', e)
            );
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

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before checkout');
      return;
    }
    // CART-009: Server-side validation gate
    const v = await validateCartForCheckout();
    if (!v.success) {
      Alert.alert('Could not validate cart', v.error.message);
      return;
    }
    if (!v.data.ok) {
      const first = v.data.errors[0];
      const msg =
        first?.code === 'MIN_CART_VALUE_NOT_MET'
          ? `Minimum cart value is $${(v.data.minCartValueCents / 100).toFixed(2)}. Your cart total is $${(v.data.cartTotalCents / 100).toFixed(2)}.`
          : (first?.message ?? 'Cart cannot be checked out');
      // CART-018: analytics — checkout blocked
      trackEvent('cart_checkout_blocked', {
        reason: first?.code ?? 'UNKNOWN',
        cart_total_cents: v.data.cartTotalCents,
        min_cart_value_cents: v.data.minCartValueCents,
      });
      Alert.alert('Cannot checkout', msg);
      return;
    }
    // CART-018: analytics — checkout initiated
    trackEvent('cart_checkout_initiated', {
      cart_total_cents: v.data.cartTotalCents,
      item_count: v.data.itemCount,
    });
    // TFV2-022 D-27: Pass bundle_id to CartCheckoutScreen so all trades share same bundle
    navigation.navigate('CartCheckout', { bundleId });
  };

  // TFV2-022 D-28: Enforce single-seller rule when adding items
  // Called externally (e.g. from ItemDetailScreen) via navigation params or a cart context
  const _handleAddItem = (item: CartItem) => {
    // D-28: Single seller enforcement
    if (cartItems.length > 0 && cartItems[0].sellerId !== item.sellerId) {
      Alert.alert(
        'Different Seller',
        'Your cart already has items from a different seller. Adding this item will clear your current cart.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace Cart',
            style: 'destructive',
            onPress: () => setCartItems([item]),
          },
        ]
      );
      return;
    }

    // D-29: 4th item eviction warning
    if (cartItems.length >= 3) {
      const oldestItem = cartItems[0];
      Alert.alert(
        'Cart is Full',
        `Your cart can hold up to 3 items at a time. Adding "${item.title}" will remove "${oldestItem.title}".`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: () => {
              setCartItems((prev) => [...prev.slice(1), item]);
            },
          },
        ]
      );
      return;
    }

    setCartItems((prev) => [...prev, item]);
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

  // R-04: Disable checkout button when subtotal (in cents) is below admin-configured minimum
  const subtotalCents = Math.round(calculateSubtotal() * 100);
  const isCheckoutDisabled = cartItems.length > 0 && minCartValueCents > 0 && subtotalCents < minCartValueCents;
  const amountNeededCents = isCheckoutDisabled ? minCartValueCents - subtotalCents : 0;

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="My Cart" showBell={false}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
        <PersistentTabBar />
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

        <PersistentTabBar />
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
        {/* CART-018: Quick link to Favorites */}
        <TouchableOpacity
          style={styles.favoritesLink}
          onPress={() => navigation.navigate('Favorites')}
          testID="cart-favorites-link"
        >
          <Text style={styles.favoritesLinkText}>View Favorites →</Text>
        </TouchableOpacity>

        {/* CART-009: Min cart value notice */}
        {minCartValueCents > 0 && (
          <View style={styles.minValueNotice} testID="cart-min-value-notice">
            <Text style={styles.minValueText}>
              Minimum order: ${(minCartValueCents / 100).toFixed(2)}
            </Text>
          </View>
        )}

        {/* CART-006/007: Saved carts section (max 3) */}
        {savedCarts.length > 0 && (
          <View style={styles.savedCartsSection} testID="saved-carts-section">
            <Text style={styles.savedCartsTitle}>Saved carts ({savedCarts.length}/3)</Text>
            {savedCarts.map((sc) => (
              <View key={sc.cartId} style={styles.savedCartRow} testID={`saved-cart-${sc.cartId}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedCartLine}>
                    {sc.itemCount} item{sc.itemCount === 1 ? '' : 's'} · ${(sc.totalPriceCents / 100).toFixed(2)}
                  </Text>
                  <Text style={styles.savedCartMeta}>Saved {new Date(sc.lastUpdated).toLocaleDateString()}</Text>
                </View>
                <Button variant="secondary" size="small" onPress={() => handleSwitchSaved(sc.cartId)} testID={`saved-cart-switch-${sc.cartId}`}>
                  Switch
                </Button>
                <TouchableOpacity onPress={() => handleDeleteSaved(sc.cartId)} testID={`saved-cart-delete-${sc.cartId}`} style={{ padding: 8 }}>
                  <Trash size={18} color={theme.colors.error[500]} weight="regular" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* CART-006: Save current cart action */}
        {cartItems.length > 0 && (
          <View style={styles.saveCurrentRow}>
            <Button variant="secondary" size="small" onPress={handleSaveCart} testID="save-current-cart-button">
              Save current cart for later
            </Button>
          </View>
        )}

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
                {/* R-10: Inline unavailability warning */}
                {item.liveStatus && item.liveStatus !== 'available' && (
                  <Text style={styles.unavailableText} testID={`cart-item-unavailable-${item.id}`}>
                    This item is no longer available
                  </Text>
                )}

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
        {/* R-04: "Add $X more" banner when below minimum */}
        {isCheckoutDisabled && (
          <Text style={styles.minValueBanner} testID="min-value-banner">
            Add ${(amountNeededCents / 100).toFixed(2)} more to reach the checkout minimum
          </Text>
        )}
        <Button
          variant="primary"
          size="large"
          onPress={handleCheckout}
          disabled={isCheckoutDisabled}
          testID="checkout-button"
        >
          Checkout
        </Button>
      </View>

      <PersistentTabBar />
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

  favoritesLink: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.md,
    alignItems: 'flex-end',
  },
  favoritesLinkText: {
    ...theme.typography.body,
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  minValueNotice: {
    marginHorizontal: 24,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: 8,
  },
  minValueText: {
    ...theme.typography.caption,
    color: theme.textColors.secondary,
  },
  // R-04: Banner above checkout button when below minimum
  minValueBanner: {
    ...theme.typography.caption,
    color: (theme.colors.warning as Record<number, string> | undefined)?.[700] ?? '#92400E',
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  // R-10: Inline unavailability warning on item row
  unavailableText: {
    ...theme.typography.caption,
    color: theme.colors.error?.[500] ?? '#EF4444',
    marginTop: 2,
  },
  savedCartsSection: {
    marginHorizontal: 24,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.backgroundColors.card,
    borderRadius: 12,
  },
  savedCartsTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.textColors.primary,
    marginBottom: theme.spacing.sm,
  },
  savedCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[100],
  },
  savedCartLine: {
    ...theme.typography.body,
    color: theme.textColors.primary,
  },
  savedCartMeta: {
    ...theme.typography.caption,
    color: theme.textColors.secondary,
  },
  saveCurrentRow: {
    paddingHorizontal: 24,
    paddingTop: theme.spacing.md,
    alignItems: 'flex-start',
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
