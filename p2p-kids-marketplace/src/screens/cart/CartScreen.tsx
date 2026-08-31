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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Crypto from 'expo-crypto';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import {
  getCartItems,
  removeFromCart,
  CartItem as ServiceCartItem,
  saveCurrentCart,
  switchToSavedCart,
  clearCart,
  validateCartForCheckout,
  subscribeToCartChanges,
  SavedCartSummary,
} from '@/services/cartService';
import { getMaskedSellerListings } from '@/services/listing';
import { calculateCategorySP } from '@/services/categoryService';
import { captureException } from '@/services/errorReporter';
import { supabase } from '@/config/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button, Modal } from '@/components/ui';
import { theme } from '@/theme';
import { trackEvent } from '@/services/analytics';
import { ShoppingCart, Trash, Coins, Package, SquaresFour, X } from 'phosphor-react-native';
import ScreenLayout from '@/components/ScreenLayout';
import { showDifferentSellerModal } from '@/components/molecules/DifferentSellerModal';
import { useCartContext } from '@/contexts/CartContext';

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
  acceptsSP?: boolean;
}

export default function CartScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { refreshCartCount } = useCartContext();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [savedCarts, setSavedCarts] = useState<SavedCartSummary[]>([]);
  const [minCartValueCents, setMinCartValueCents] = useState<number>(0);
  const [spDiscount, _setSpDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  // TFV2-022: D-27 bundle_id shared by all items in this cart session
  const [bundleId] = useState<string>(() => Crypto.randomUUID());

  // SELLER-GROUP-007: Total count of seller's approved listings (for "more from this seller" banner)
  const [sellerTotalListings, setSellerTotalListings] = useState(0);
  const [showMoreFromSellerBanner, setShowMoreFromSellerBanner] = useState(true);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchTargetCartId, setSwitchTargetCartId] = useState<string | null>(null);
  // CART-009: Min cart value modal state
  const [showMinValueModal, setShowMinValueModal] = useState(false);
  const [minValueModalMessage, setMinValueModalMessage] = useState('');

  // Compute remaining items not yet in basket (clamped to 0 for safety)
  const sellerId = cartItems.length > 0 ? cartItems[0].sellerId : null;
  const remainingFromSeller = Math.max(0, sellerTotalListings - cartItems.length);

  // CART M12 (QA Task 7): subscriber flag + per-item "Up to N SP" (category cap)
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [spMaxByListing, setSpMaxByListing] = useState<Record<string, number>>({});

  // M13 (QA Task 7): an item is "unavailable" when its live status is present and
  // not 'available' — mirrors the inline "no longer available" label logic below.
  const isItemUnavailable = (item: CartItem) =>
    !!item.liveStatus && item.liveStatus !== 'available';

  const loadCartItems = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCartItems();
      if (result.success) {
        const mapped: CartItem[] = result.data.items.map((i: ServiceCartItem) => ({
          id: i.id,
          listingId: i.listingId,
          title: i.title ?? 'Untitled',
          price: i.price ?? 0,
          quantity: 1,
          imageUrl: i.imageUrl ?? '',
          sellerId: i.sellerId,
          liveStatus: i.liveStatus,
          acceptsSP: i.acceptsSP,
        }));
        setCartItems(mapped);
        setSavedCarts(result.data.savedCarts ?? []);
        setIsSubscriber(!!result.data.isSubscriber);
      } else {
        console.warn('[CartScreen] Load warning:', result.error.message);
      }
    } catch (error) {
      captureException(error, {
        tags: { screen: 'CartScreen', action: 'load_cart' },
      });
      Alert.alert('Error', 'Failed to load cart items');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch cart items every time this screen gains focus (handles case where
  // items were added on ItemDetailScreen/MoreFromThisSeller while Cart was
  // already mounted in the navigation stack).
  useFocusEffect(
    useCallback(() => {
      loadCartItems();
      refreshCartCount();
    }, [loadCartItems, refreshCartCount])
  );

  // CART-016: Realtime subscription — cart_items changes for this user.
  // Uses ref to avoid the async subscribe / cleanup race condition.
  // Does NOT depend on cartItems — the subscription is set up once on mount
  // and cleaned up on unmount. The DB trigger tr_touch_cart_on_item_status_change
  // (migration 20260720000001) bridges items.status changes into cart_items updates.
  // See cartService.subscribeToCartChanges for the full RLS rationale.
  const unsubscribeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      unsubscribeRef.current = subscribeToCartChanges(user.id, () => {
        loadCartItems();
      });
    })();
    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [loadCartItems]);

  // SELLER-GROUP-007: Fetch seller's total approved listings for "more from this seller" banner
  useEffect(() => {
    (async () => {
      if (!sellerId) {
        setSellerTotalListings(0);
        return;
      }
      try {
        const result = await getMaskedSellerListings(sellerId);
        setSellerTotalListings(result.total_count);
        setShowMoreFromSellerBanner(true);
      } catch {
        setSellerTotalListings(0);
      }
    })();
  }, [sellerId]);

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

  // CART M12 (QA Task 7): for subscribers, load each Accept-SP item's category
  // spending cap (same calculateCategorySP source checkout uses) so the cart can
  // show a "Up to N SP" figure before the buyer reaches checkout.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const targets = cartItems.filter((item) => item.acceptsSP && !isItemUnavailable(item));
      const next: Record<string, number> = {};
      await Promise.all(
        targets.map(async (item) => {
          if (!isSubscriber) return;
          try {
            const { data: listingData } = await supabase
              .from('items')
              .select('category_id')
              .eq('id', item.listingId)
              .single();
            if (!listingData?.category_id) return;
            const spConfig = await calculateCategorySP(listingData.category_id, item.price);
            if (spConfig) next[item.listingId] = spConfig.max_spend_sp;
          } catch {
            console.warn(`[CartScreen] Could not load SP cap for listing ${item.listingId}`);
          }
        })
      );
      if (!cancelled) setSpMaxByListing(next);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [cartItems, isSubscriber]);

  const handleClearCart = () => {
    Alert.alert(
      'Clear Trade Basket',
      'Are you sure you want to remove all items from your trade basket?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Basket',
          style: 'destructive',
          onPress: async () => {
            const r = await clearCart();
            if (!r.success) {
              Alert.alert('Could not clear basket', r.error.message);
              return;
            }
            trackEvent('cart_cleared', { cleared_items: r.data.clearedItems });
            await loadCartItems();
            refreshCartCount();
          },
        },
      ]
    );
  };

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
    refreshCartCount();
  };

  const handleSwitchSaved = (cartId: string) => {
    setSwitchTargetCartId(cartId);
    setShowSwitchModal(true);
  };

  const confirmSwitchCart = async () => {
    if (!switchTargetCartId) return;
    setShowSwitchModal(false);
    const prevCartId = bundleId;
    const r = await switchToSavedCart(switchTargetCartId);
    if (!r.success) {
      // QA Task 9 (M10): never surface the raw server error string. The switch
      // path previously leaked "SAVED_CART_LIMIT_REACHED: user already has 3
      // saved carts" (DB trigger text) to the user. The RPC now returns the
      // friendly structured message, but map the known raw prefix here too as
      // a safety net so no developer-facing text can ever reach the UI.
      const message =
        r.error.code === 'SAVED_CART_LIMIT_REACHED' ||
        r.error.message.includes('SAVED_CART_LIMIT_REACHED')
          ? 'You already have 3 saved carts. Delete one to save a new one.'
          : r.error.message;
      Alert.alert('Could not switch', message);
      return;
    }
    // CART-018: analytics
    trackEvent('cart_switched', { from_cart_id: prevCartId, to_cart_id: switchTargetCartId });
    await loadCartItems();
    refreshCartCount();
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
          refreshCartCount();
        },
      },
    ]);
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const removedItem = cartItems.find((item) => item.id === itemId);
          setCartItems((prev) => prev.filter((item) => item.id !== itemId));
          // CART-018: analytics
          trackEvent('cart_item_removed', {
            listing_id: removedItem?.listingId ?? itemId,
            reason: 'user_action',
          });
          await removeFromCart(itemId).catch((e) =>
            console.warn('[CartScreen] removeFromCart error:', e)
          );
          // Reload from server to refresh savedCarts + ensure sync
          await loadCartItems();
          refreshCartCount();
        },
      },
    ]);
  };

  // FLOW-07 (2026-08-01): Tap an item card -> open that item's detail screen.
  // ListingDetail is pushed onto the stack, so Back returns to the Trade Basket
  // with all state (items, scroll) preserved.
  const handleOpenItemDetail = (item: CartItem) => {
    navigation.navigate('ListingDetail', { listing_id: item.listingId });
  };

  // TFV2-022 D-28: Enforce single-seller rule when adding items
  // Called externally (e.g. from ItemDetailScreen) via navigation params or a cart context
  // SELLER-GROUP-003: Uses shared DifferentSellerModal — generic copy, no seller name leak
  const _handleAddItem = (item: CartItem) => {
    // D-28: Single seller enforcement
    if (cartItems.length > 0 && cartItems[0].sellerId !== item.sellerId) {
      showDifferentSellerModal({
        onSaveAndStartNew: async () => {
          await saveCurrentCart();
          refreshCartCount();
          setCartItems([item]);
        },
        onReplaceCart: async () => {
          const cleared = await clearCart();
          if (!cleared.success) {
            Alert.alert('Could not replace cart', cleared.error.message);
            return;
          }
          refreshCartCount();
          setCartItems([item]);
        },
      });
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

  // CART-009: Navigate to MoreFromThisSeller from the min value modal
  const handleBrowseFromMinValueModal = () => {
    setShowMinValueModal(false);
    if (sellerId) {
      navigation.navigate('MoreFromThisSeller', { sellerId, returnToCart: true });
    }
  };

  // M13 (QA Task 7): subtotal excludes realtime-unavailable items (they stay in
  // the list, flagged "no longer available"), so the total reflects only what can
  // actually be traded. calculateTotal and subtotalCents both derive from this.
  const calculateSubtotal = () => {
    return cartItems.reduce(
      (sum, item) => sum + (isItemUnavailable(item) ? 0 : item.price * item.quantity),
      0
    );
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - spDiscount);
  };

  // Subtotal in cents for analytics and validation
  const subtotalCents = Math.round(calculateSubtotal() * 100);

  if (loading) {
    return (
      <ScreenLayout variant="tab" title="Trade Basket">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading trade basket...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // Show full empty placeholder only when there is nothing at all (no items, no saved carts)
  if (cartItems.length === 0 && savedCarts.length === 0) {
    return (
      <ScreenLayout variant="tab" title="Trade Basket">
        <View style={styles.emptyContainer}>
          <ShoppingCart
            size={64}
            color={theme.colors.neutral[300]}
            weight="regular"
            testID="cart-empty-icon"
          />
          <Text style={styles.emptyTitle}>Your trade basket is empty</Text>
          <Text style={styles.emptySubtext}>Start adding items you love to your trade basket</Text>
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
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="tab" title="Trade Basket">
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
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cart favorites link"
        >
          <Text style={styles.favoritesLinkText}>View Favorites →</Text>
        </TouchableOpacity>

        {/* CART-009: Min cart value branded notice with CTA */}
        {minCartValueCents > 0 && subtotalCents < minCartValueCents && (
          <View style={styles.minValueBannerCard} testID="cart-min-value-banner">
            <View style={styles.minValueBannerTextWrap}>
              <Text style={styles.minValueBannerTitle}>
                Add ${((minCartValueCents - subtotalCents) / 100).toFixed(2)} more to check out
              </Text>
              <Text style={styles.minValueBannerSubtext}>
                Minimum checkout is ${(minCartValueCents / 100).toFixed(2)}.
                {remainingFromSeller > 0
                  ? ' Browse more items from this seller to fill your Trade Basket!'
                  : ''}
              </Text>
            </View>
            {remainingFromSeller > 0 && sellerId && (
              <TouchableOpacity
                style={styles.minValueBrowseButton}
                onPress={() => {
                  navigation.navigate('MoreFromThisSeller', { sellerId, returnToCart: true });
                }}
                activeOpacity={0.7}
                testID="cart-min-value-browse-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Cart min value browse button"
              >
                <SquaresFour size={16} color="#FFFFFF" weight="fill" />
                <Text style={styles.minValueBrowseButtonText}>
                  Browse {remainingFromSeller} More Item{remainingFromSeller !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* CART-006/007: Saved carts section (max 3) — always visible when saved carts exist */}
        {savedCarts.length > 0 && (
          <View style={styles.savedCartsSection} testID="saved-carts-section">
            <Text style={styles.savedCartsTitle}>Saved carts ({savedCarts.length}/3)</Text>
            {savedCarts.map((sc) => (
              <View key={sc.cartId} style={styles.savedCartRow} testID={`saved-cart-${sc.cartId}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedCartLine}>
                    {sc.itemCount} item{sc.itemCount === 1 ? '' : 's'} · $
                    {(sc.totalPriceCents / 100).toFixed(2)}
                  </Text>
                  <Text style={styles.savedCartMeta}>
                    Saved {new Date(sc.lastUpdated).toLocaleDateString()}
                  </Text>
                </View>
                <Button
                  variant="secondary"
                  size="small"
                  onPress={() => handleSwitchSaved(sc.cartId)}
                  testID={`saved-cart-switch-${sc.cartId}`}
                >
                  Switch
                </Button>
                <TouchableOpacity
                  accessible
                  accessibilityRole="button"
                  onPress={() => handleDeleteSaved(sc.cartId)}
                  testID={`saved-cart-delete-${sc.cartId}`}
                  style={{ padding: 8 }}
                >
                  <Trash size={18} color={theme.colors.error[500]} weight="regular" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* CART-006: Save current cart action */}
        {cartItems.length > 0 && (
          <View style={styles.saveCurrentRow}>
            <Button
              variant="secondary"
              size="small"
              onPress={handleSaveCart}
              testID="save-current-cart-button"
            >
              Save current cart for later
            </Button>
          </View>
        )}

        <View style={styles.itemsList}>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.itemRow} testID={`cart-item-${item.id}`}>
              {/* FLOW-07: Tap thumbnail + title area -> open item detail (back returns to basket) */}
              <TouchableOpacity
                accessible
                accessibilityRole="button"
                style={styles.itemTapTarget}
                activeOpacity={0.7}
                onPress={() => handleOpenItemDetail(item)}
                testID={`cart-item-open-${item.id}`}
              >
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
                  {/* Useful Item Info (replaces quantity controls — no inventory) */}
                  <View style={styles.itemInfoRow}>
                    {item.liveStatus === 'available' && (
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableBadgeText}>Available</Text>
                      </View>
                    )}
                    {item.liveStatus && item.liveStatus !== 'available' && (
                      <Text
                        style={styles.unavailableText}
                        testID={`cart-item-unavailable-${item.id}`}
                      >
                        This item is no longer available
                      </Text>
                    )}
                    {item.acceptsSP && (
                      <View style={styles.acceptsSpBadge}>
                        <Coins size={14} color="#F59E0B" weight="fill" />
                        <Text style={styles.acceptsSpText}>
                          Accepts Points
                          {isSubscriber && spMaxByListing[item.listingId] != null ? (
                            ` · Up to ${spMaxByListing[item.listingId]} SP`
                          ) : null}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* DEV-TASK-73: Accept-SP item with no category cap (NULL category) —
                      checkout renders no SP input for it, so the "Accepts Points" tag
                      would over-promise. Muted note for subscribers (the only users
                      who'd expect the input) on an otherwise-eligible item. */}
                  {isSubscriber &&
                    item.acceptsSP &&
                    !isItemUnavailable(item) &&
                    spMaxByListing[item.listingId] == null && (
                      <Text
                        style={styles.pointsUnavailableText}
                        testID={`cart-item-points-unavailable-${item.id}`}
                      >
                        Points unavailable for this item
                      </Text>
                    )}
                </View>
              </TouchableOpacity>

              {/* Remove Button */}
              <TouchableOpacity
                accessible
                accessibilityRole="button"
                onPress={() => handleRemoveItem(item.id)}
                style={styles.trashButton}
                testID={`cart-item-remove-${item.id}`}
              >
                <Trash size={20} color={theme.colors.error[500]} weight="regular" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* SELLER-GROUP-007: "More from this seller" banner — shown when seller
            has items not yet in basket. DEV-TASK-49: placed right after the item
            list (above the summary + fixed CTA sheet) so it can never render in
            the CTA/pill zone and look like an overlapping control.
            DEV-TASK-72: styled as a NEUTRAL secondary info card (distinct from
            the green primary bundle CTA) so its "View" link can't be mistaken
            for the make-offer button. */}
        {sellerId && remainingFromSeller > 0 && showMoreFromSellerBanner && (
          <View style={styles.moreFromSellerBanner} testID="cart-more-from-seller-banner">
            <TouchableOpacity
              style={styles.moreFromSellerBannerContent}
              onPress={() => {
                navigation.navigate('MoreFromThisSeller', {
                  sellerId,
                  returnToCart: true,
                });
              }}
              activeOpacity={0.7}
            >
              <SquaresFour size={18} color="#5DBB8E" weight="fill" />
              <View style={styles.moreFromSellerBannerTextWrap}>
                <Text style={styles.moreFromSellerBannerTitle}>
                  This seller has {remainingFromSeller} more item
                  {remainingFromSeller !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.moreFromSellerBannerLink}>View</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreFromSellerBannerDismiss}
              onPress={() => setShowMoreFromSellerBanner(false)}
              hitSlop={8}
              testID="cart-more-from-seller-dismiss"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cart more from seller dismiss"
            >
              <X size={16} color="#6B7280" weight="bold" />
            </TouchableOpacity>
          </View>
        )}

        {/* CART-005: Clear Basket button */}
        {cartItems.length > 0 && (
          <TouchableOpacity
            style={styles.clearBasketRow}
            onPress={handleClearCart}
            testID="clear-basket-button"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Clear basket button"
          >
            <Trash size={16} color={theme.colors.error[500]} weight="regular" />
            <Text style={styles.clearBasketText}>Clear Basket</Text>
          </TouchableOpacity>
        )}

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

        {/* CART-009: Min cart value branded modal — shows when cart total is below the configured minimum */}
        <Modal
          visible={showMinValueModal}
          title="Minimum checkout not met"
          message={minValueModalMessage}
          primaryButtonText={remainingFromSeller > 0 && sellerId ? 'Browse More Items' : undefined}
          secondaryButtonText={remainingFromSeller > 0 && sellerId ? 'Cancel' : 'OK'}
          onPrimaryPress={handleBrowseFromMinValueModal}
          onSecondaryPress={() => setShowMinValueModal(false)}
          onClose={() => setShowMinValueModal(false)}
          showCloseButton={false}
        />

        {/* Branded switch-cart confirmation modal — replaces native Alert.alert per design system BP rule */}
        <Modal
          visible={showSwitchModal}
          title="Switch saved cart?"
          message="Your current active cart will be saved and the selected cart will become active."
          primaryButtonText="Switch"
          secondaryButtonText="Cancel"
          onPrimaryPress={confirmSwitchCart}
          onSecondaryPress={() => setShowSwitchModal(false)}
          onClose={() => setShowSwitchModal(false)}
          showCloseButton={false}
        />

      </ScrollView>

      {/* SELLER-GROUP-005: Make-offer CTA — fixed above the floating pill nav so
          it never overlaps the tab bar (DEV-TASK-48 P3: it used to be the last
          in-flow ScrollView child at y 845-916, sliding under the tab bar
          y 868-905 → taps near the CTA bottom hit a tab). Same bottom:120
          clearance BulkPublishBar uses (pill top ~110pt from screen bottom). */}
      <View style={styles.bundleCtaBar}>
        <TouchableOpacity
          style={styles.bundleCta}
          onPress={async () => {
            if (cartItems.length === 0) {
              Alert.alert('Empty Cart', 'Please add items before making an offer');
              return;
            }
            // CART-009: Server-side validation gate (moved from removed Checkout button)
            const v = await validateCartForCheckout();
            if (!v.success) {
              Alert.alert('Could not validate cart', v.error.message);
              return;
            }
            if (!v.data.ok) {
              const first = v.data.errors[0];
              trackEvent('cart_checkout_blocked', {
                reason: first?.code ?? 'UNKNOWN',
                cart_total_cents: v.data.cartTotalCents,
                min_cart_value_cents: v.data.minCartValueCents,
              });
              // CART-009: Show branded modal with option to browse more items
              if (first?.code === 'MIN_CART_VALUE_NOT_MET') {
                const needed = ((v.data.minCartValueCents - v.data.cartTotalCents) / 100).toFixed(
                  2
                );
                const minTotal = (v.data.minCartValueCents / 100).toFixed(2);
                const currentTotal = (v.data.cartTotalCents / 100).toFixed(2);
                setMinValueModalMessage(
                  `Add $${needed} more to reach the $${minTotal} minimum. ` +
                    `Your current total is $${currentTotal}.`
                );
                setShowMinValueModal(true);
                return;
              }
              const msg = first?.message ?? 'Cart cannot be checked out';
              Alert.alert('Could not validate cart', msg);
              return;
            }
            trackEvent('bundle_cta_tapped', {
              item_count: cartItems.length,
              subtotal_cents: subtotalCents,
            });
            trackEvent('cart_checkout_initiated', {
              cart_total_cents: v.data.cartTotalCents,
              item_count: v.data.itemCount,
            });
            // TFV2-022 D-27: Pass bundle_id so all trades share same bundle
            navigation.navigate('CartCheckout', {
              bundleId,
              bundleMode: cartItems.length >= 2,
            });
          }}
          testID="bundle-cta-button"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Make offer"
        >
          <Package size={20} color="#5DBB8E" weight="fill" />
          <View style={styles.bundleCtaTextWrap}>
            <Text style={styles.bundleCtaTitle}>
              {cartItems.length >= 2
                ? `Make one offer for these ${cartItems.length} items`
                : 'Make an offer for this item'}
            </Text>
            <Text style={styles.bundleCtaSubtext}>
              {cartItems.length >= 2 ? 'All items from this seller' : ''}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
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
    // DEV-TASK-48 (P3): the Make-offer CTA is now a FIXED bar above the floating
    // tab pill, so scroll content needs enough bottom clearance to fully scroll
    // past it. DEV-TASK-49 (UX): the bar is a bottom-sheet card at bottom:134
    // with ~88pt height (sheet top ≈737pt from screen top) — 244pt clearance
    // keeps the last rows fully scrollable above the sheet (~25pt of air at max
    // scroll: 244 − (134 + 85 card height)).
    paddingBottom: 244,
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
  // CART-009: Branded minimum value warning card with CTA button
  minValueBannerCard: {
    marginHorizontal: 24,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: '#EEF9F4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5DBB8E',
  },
  minValueBannerTextWrap: {
    marginBottom: theme.spacing.sm,
  },
  minValueBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D6A4F',
    marginBottom: 4,
  },
  minValueBannerSubtext: {
    fontSize: 13,
    color: '#5DBB8E',
    lineHeight: 18,
  },
  minValueBrowseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5DBB8E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  minValueBrowseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Removed unused minValueBanner style — replaced by minValueBannerCard above
  // Item info badges (replaces quantity controls)
  itemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  availableBadge: {
    backgroundColor: '#E8F5F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  availableBadgeText: {
    fontSize: 11,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  unavailableText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '500',
  },
  acceptsSpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    alignSelf: 'flex-start',
  },
  acceptsSpText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  // DEV-TASK-73: muted note under the "Accepts Points" tag when an Accept-SP
  // item has no category cap (NULL category) — checkout renders no SP input.
  pointsUnavailableText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: theme.spacing.xs,
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
  itemTapTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  trashButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },

  clearBasketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    marginHorizontal: 24,
    paddingVertical: theme.spacing.sm,
  },
  clearBasketText: {
    ...theme.typography.body,
    color: theme.colors.error[500],
    fontWeight: '500',
    fontSize: 14,
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
    // Clear the floating pill nav (PersistentTabBar now overlays the stack
    // content): pill top sits ~110pt from the bottom (safe-area + spacing.sm +
    // pill height), so the sticky total/checkout bar must sit above it.
    bottom: 120,
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

  // SELLER-GROUP-007: "More from this seller" banner styles
  moreFromSellerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    // DEV-TASK-72: neutral secondary palette (gray-50 bg, gray-200 border) —
    // visually distinct from the solid-green bundle CTA pill (#EEF9F4/#5DBB8E),
    // so the banner's "View" link reads as an info row, not a make-offer button.
    // DEV-TASK-73: marginBottom bumped xs → md so the banner's "View" link sits
    // further from the bundle CTA below it (QA Task 12 accidental-tap risk).
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingLeft: 12,
  },
  moreFromSellerBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  moreFromSellerBannerTextWrap: {
    flex: 1,
  },
  moreFromSellerBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B6B6B',
  },
  moreFromSellerBannerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5DBB8E',
    marginTop: 2,
  },
  moreFromSellerBannerDismiss: {
    padding: 12,
  },

  // SELLER-GROUP-005: Bundle CTA styles
  // DEV-TASK-48 (P3): fixed bar cleared above the floating pill nav — the bar
  // renders outside the ScrollView so it never slides under the tab bar.
  // DEV-TASK-49 (UX): restyled as a padded bottom-sheet-style container for
  // unambiguous visual separation from the pill on every device size:
  //  - bottom:134 keeps the sheet clearly above the pill top (~848pt from the
  //    top on iPhone 17 Pro Max) while ALSO clearing the last scroll row: the
  //    old bottom:164 floated the sheet ~56pt above the pill, which landed the
  //    sheet's top edge (~706pt) ON TOP of the Subtotal row (ends ~712pt) —
  //    read as "CTA overlaps content / not anchored at the bottom". At bottom:134
  //    the sheet top (~737pt) clears Subtotal by ~25pt and the sheet bottom
  //    (~822pt) sits ~26pt above the pill. Measured on-device (iPhone 17 Pro Max).
  //  - white card + shadow level2 ("modals, bottom sheets") + 8pt padding make
  //    the CTA read as a floating sheet rather than a tab-bar extension.
  bundleCtaBar: {
    position: 'absolute',
    bottom: 134,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: theme.spacing.sm,
    ...theme.shadows.level2,
  },
  bundleCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF9F4',
    borderRadius: 12,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#5DBB8E',
    gap: 12,
  },
  bundleCtaTextWrap: {
    flex: 1,
  },
  bundleCtaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  bundleCtaSubtext: {
    fontSize: 13,
    color: '#5DBB8E',
    marginTop: 2,
  },
});
