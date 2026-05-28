/**
 * File: p2p-kids-marketplace/src/screens/favorites/FavoritesScreen.tsx
 * MODULE-15.2 CART-018: Favorites list — bookmark items separate from cart.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Heart, Trash } from 'phosphor-react-native';
import { RootStackParamList } from '@/navigation/types';
import { getFavorites, removeFavorite, Favorite } from '@/services/favoritesService';
import { addToCart } from '@/services/cartService';
import { theme } from '@/theme';
import { Button } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const navigation = useNavigation<Nav>();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await getFavorites();
    if (res.success) setFavorites(res.data);
    else console.warn('[FavoritesScreen]', res.error);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleRemove = (listingId: string) => {
    Alert.alert('Remove favorite?', 'This item will be removed from your favorites.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setFavorites((prev) => prev.filter((f) => f.listingId !== listingId));
          await removeFavorite(listingId);
        },
      },
    ]);
  };

  const handleMoveToCart = async (f: Favorite) => {
    const r = await addToCart({ listingId: f.listingId, sellerId: f.sellerId });
    if (!r.success) {
      Alert.alert('Could not add to cart', r.error.message);
      return;
    }
    Alert.alert('Added to cart', `"${f.title}" was added to your cart.`);
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Favorites">
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
        <PersistentTabBar />
      </ScreenLayout>
    );
  }

  if (favorites.length === 0) {
    return (
      <ScreenLayout variant="detail" title="Favorites">
        <View style={styles.center} testID="favorites-empty">
          <Heart size={64} color={theme.colors.neutral[300]} weight="regular" />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptySub}>Tap the heart on any listing to save it for later.</Text>
          <Button
            variant="primary"
            size="large"
            onPress={() => navigation.navigate('Discover')}
            testID="favorites-browse-button"
          >
            Browse Items
          </Button>
        </View>
        <PersistentTabBar />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Favorites">
      <FlatList
        testID="favorites-list"
        data={favorites}
        keyExtractor={(f) => f.favoriteId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`favorite-row-${item.listingId}`}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ListingDetail', { listing_id: item.listingId } as never)}
              style={styles.thumbWrap}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
            </TouchableOpacity>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.price} testID={`favorite-price-${item.listingId}`}>
                ${(item.priceCents / 100).toFixed(2)}
              </Text>
              {item.status !== 'available' && (
                <Text style={styles.unavailable} testID={`favorite-unavailable-${item.listingId}`}>
                  No longer available
                </Text>
              )}
              <View style={styles.actions}>
                <Button
                  variant="primary"
                  size="small"
                  onPress={() => handleMoveToCart(item)}
                  disabled={item.status !== 'available'}
                  testID={`favorite-add-to-cart-${item.listingId}`}
                >
                  Add to Cart
                </Button>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleRemove(item.listingId)}
              style={styles.trash}
              testID={`favorite-remove-${item.listingId}`}
            >
              <Trash size={20} color={theme.colors.error[500]} weight="regular" />
            </TouchableOpacity>
          </View>
        )}
      />
      <PersistentTabBar />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { ...theme.typography.h2, marginTop: 16, color: theme.textColors.primary },
  emptySub: { ...theme.typography.body, color: theme.textColors.secondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  listContent: { padding: 16, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  thumbWrap: { marginRight: 12 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: theme.colors.neutral[100] },
  thumbPlaceholder: { backgroundColor: theme.colors.neutral[200] },
  info: { flex: 1 },
  title: { ...theme.typography.body, fontWeight: '600', color: theme.textColors.primary },
  price: { ...theme.typography.body, marginTop: 4, color: theme.textColors.primary },
  unavailable: { ...theme.typography.caption, color: theme.colors.error[500], marginTop: 4 },
  actions: { marginTop: 8, alignSelf: 'flex-start' },
  trash: { padding: 8, marginLeft: 8 },
});
