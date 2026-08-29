/**
 * File: p2p-kids-marketplace/src/screens/home/MoreFromThisSellerScreen.tsx
 *
 * SELLER-GROUP-007: "More from this seller" — masked seller listing page.
 *
 * Lightweight, standalone page showing a specific seller's other approved listings.
 * Opened from ItemDetailScreen via the "More from this seller" CTA icon.
 *
 * Key rules:
 * - NEVER shows seller name, avatar, location, or any PII.
 * - Title is generic: "More items from this seller"
 * - Each item supports "Add to Cart" directly.
 * - "Matches Your Cart" indicator shown when buyer's active cart matches this seller.
 * - Renders nothing identifiable — purely a filtered item grid.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SuccessToast } from '@/components/ui';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import ScreenLayout from '@/components/ScreenLayout';
import { captureException } from '@/services/errorReporter';
import { ListingImage } from '@/components/atoms';
import MatchesCartBadge from '@/components/molecules/MatchesCartBadge';
import { showDifferentSellerModal } from '@/components/molecules/DifferentSellerModal';
import { getMaskedSellerListings, MaskedSellerListing } from '@/services/listing';
import { addToCart, getCartItems, saveCurrentCart, clearCart } from '@/services/cartService';
import { useCartContext } from '@/contexts/CartContext';
import { getSellerGroup, isSameSellerGroup } from '@/utils/sellerGroup';
import { ShoppingCart, Heart, HeartStraight } from 'phosphor-react-native';
import { getFavorites, toggleFavorite } from '@/services/favoritesService';
import { trackEvent } from '@/services/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MoreFromThisSeller'>;

// Load listings in pages of 10 so the initial render stays fast when a seller
// has many items; further pages load on scroll until "No more items" shows.
const PAGE_SIZE = 10;

export default function MoreFromThisSellerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { sellerId, excludeListingId } = route.params;
  const { refreshCartCount } = useCartContext();

  const [listings, setListings] = useState<MaskedSellerListing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [matchesCart, setMatchesCart] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [inCartIds, setInCartIds] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Added to Trade Basket');
  const [toastSubtitle, setToastSubtitle] = useState<string | undefined>();

  // Pagination guards — refs avoid stale-closure issues in onEndReached.
  const listingsRef = useRef<MaskedSellerListing[]>([]);
  const totalCountRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMore = listings.length < totalCount;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load seller group info
      const group = await getSellerGroup(sellerId);

      // Check cart match
      const cartRes = await getCartItems();
      if (cartRes.success && cartRes.data.sellerId) {
        const cartGroup = await getSellerGroup(cartRes.data.sellerId);
        setMatchesCart(isSameSellerGroup(cartGroup.hash, group.hash));
        // Build set of listing IDs already in cart
        const cartListingIds = new Set(cartRes.data.items.map((i) => i.listingId));
        setInCartIds(cartListingIds);
      } else {
        setMatchesCart(false);
        setInCartIds(new Set());
      }

      // Load the FIRST page of masked listings (PAGE_SIZE at a time)
      const result = await getMaskedSellerListings(sellerId, excludeListingId, {
        limit: PAGE_SIZE,
        offset: 0,
      });
      listingsRef.current = result.listings;
      setListings(result.listings);
      totalCountRef.current = result.total_count;
      setTotalCount(result.total_count);

      // Load ALL favorites in ONE call. (The old per-item isFavorited loop
      // re-fetched the entire favorites list on every item — O(N) RPC calls.)
      const favRes = await getFavorites();
      if (favRes.success) {
        setFavoritedIds(new Set(favRes.data.map((f) => f.listingId)));
      }
    } catch (e) {
      captureException(e, {
        tags: { screen: 'MoreFromThisSellerScreen', action: 'load_listings' },
      });
      Alert.alert('Error', 'Could not load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [sellerId, excludeListingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const currentCount = listingsRef.current.length;
    if (currentCount >= totalCountRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await getMaskedSellerListings(sellerId, excludeListingId, {
        limit: PAGE_SIZE,
        offset: currentCount,
      });
      const merged = [...listingsRef.current, ...result.listings];
      listingsRef.current = merged;
      setListings(merged);
      totalCountRef.current = result.total_count;
      setTotalCount(result.total_count);
    } catch (e) {
      captureException(e, {
        tags: { screen: 'MoreFromThisSellerScreen', action: 'load_more' },
      });
      // Keep hasMore true so a later scroll retries instead of dead-ending.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [sellerId, excludeListingId]);

  const handleAddToCart = async (item: MaskedSellerListing) => {
    trackEvent('cart_item_added_attempt', { item_id: item.id, source: 'more_from_seller' });
    const r = await addToCart({ listingId: item.id });

    if (r.success) {
      trackEvent('cart_item_added', { item_id: item.id, source: 'more_from_seller' });
      setInCartIds((prev) => new Set(prev).add(item.id));
      refreshCartCount();
      setToastMessage('Added to Trade Basket');
      setToastSubtitle(undefined);
      setShowToast(true);
      return;
    }

    if (r.error.code === 'DIFFERENT_SELLER') {
      showDifferentSellerModal({
        onSaveAndStartNew: async () => {
          const save = await saveCurrentCart();
          if (!save.success) {
            Alert.alert('Could not save cart', save.error.message);
            return;
          }
          const retry = await addToCart({ listingId: item.id });
          if (!retry.success) {
            Alert.alert('Could not add to Trade Basket', retry.error.message);
            return;
          }
          setInCartIds((prev) => new Set(prev).add(item.id));
          refreshCartCount();
          setToastMessage('Added to Trade Basket');
          setToastSubtitle('Cart switched to new seller.');
          setShowToast(true);
        },
        onReplaceCart: async () => {
          const cleared = await clearCart();
          if (!cleared.success) {
            Alert.alert('Could not replace cart', cleared.error.message);
            return;
          }
          const retry = await addToCart({ listingId: item.id });
          if (!retry.success) {
            Alert.alert('Could not add to Trade Basket', retry.error.message);
            return;
          }
          setInCartIds((prev) => new Set(prev).add(item.id));
          refreshCartCount();
          setToastMessage('Added to Trade Basket');
          setToastSubtitle('Previous cart was replaced.');
          setShowToast(true);
        },
      });
      return;
    }

    Alert.alert('Could not add to Trade Basket', r.error.message);
  };

  const handleToggleFavorite = async (itemId: string) => {
    const currentlyFavorited = favoritedIds.has(itemId);
    // Optimistic toggle
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (currentlyFavorited) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

    const r = await toggleFavorite(itemId, currentlyFavorited);
    if (!r.success) {
      // Revert
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (currentlyFavorited) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
    }
  };

  const handleItemPress = (itemId: string) => {
    navigation.navigate('ListingDetail', { listing_id: itemId } as any);
  };

  const renderItem = ({ item }: { item: MaskedSellerListing }) => {
    const isFav = favoritedIds.has(item.id);
    const isInCart = inCartIds.has(item.id);

    return (
      <Pressable
        accessible
        accessibilityRole="button"
        style={styles.itemCard}
        onPress={() => handleItemPress(item.id)}
        testID={`more-seller-item-${item.id}`}
      >
        {/* Image */}
        <View style={styles.imageWrap}>
          <ListingImage
            url={item.image_url}
            containerStyle={styles.image}
            imageStyle={styles.image}
          />
          {/* Favorite overlay */}
          <Pressable
            style={styles.favButton}
            onPress={() => handleToggleFavorite(item.id)}
            hitSlop={8}
          >
            {isFav ? (
              <HeartStraight size={18} color="#5DBB8E" weight="fill" />
            ) : (
              <Heart size={18} color="#1A1A1A" weight="regular" />
            )}
          </Pressable>
        </View>

        {/* Details */}
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            {item.accepts_swap_points && <Text style={styles.spBadge}>SP ✓</Text>}
          </View>

          {matchesCart && <MatchesCartBadge size="small" />}

          {/* Add to Cart button */}
          <Pressable
            accessible
            accessibilityRole="button"
            style={[styles.addToCartBtn, isInCart && styles.addToCartBtnInCart]}
            onPress={() => handleAddToCart(item)}
            disabled={isInCart}
            testID={`more-seller-add-cart-${item.id}`}
          >
            <ShoppingCart size={14} color={isInCart ? '#9CA3AF' : '#5DBB8E'} weight="regular" />
            <Text style={[styles.addToCartText, isInCart && styles.addToCartTextInCart]}>
              {isInCart ? 'In Trade Basket' : 'Add to Trade Basket'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="More from this seller">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5DBB8E" />
        </View>
      </ScreenLayout>
    );
  }

  if (listings.length === 0) {
    return (
      <ScreenLayout variant="detail" title="More from this seller">
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No other items available</Text>
          <Text style={styles.emptySubtext}>
            This seller doesn't have any other listings right now.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="More from this seller">
      {/* Matches Your Cart banner */}
      {matchesCart && (
        <View style={styles.matchesBanner}>
          <ShoppingCart size={16} color="#2D6A4F" weight="fill" />
          <Text style={styles.matchesBannerText}>
            Items from this seller match your active cart.
          </Text>
        </View>
      )}

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? (
              <ActivityIndicator size="small" color="#5DBB8E" />
            ) : !hasMore && listings.length > 0 ? (
              <Text style={styles.footerText}>No more items</Text>
            ) : null}
          </View>
        }
        testID="more-from-seller-list"
      />

      {/* Auto-dismissing success toast */}
      <SuccessToast
        visible={showToast}
        message={toastMessage}
        subtitle={toastSubtitle}
        onDismiss={() => setShowToast(false)}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  matchesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF9F4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#D1F2E6',
  },
  matchesBannerText: {
    fontSize: 13,
    color: '#2D6A4F',
    fontWeight: '500',
  },
  listContent: {
    padding: 12,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  itemCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  favButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    padding: 10,
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  spBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5DBB8E',
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5DBB8E',
    marginTop: 8,
  },
  addToCartBtnInCart: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  addToCartText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  addToCartTextInCart: {
    color: '#9CA3AF',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
