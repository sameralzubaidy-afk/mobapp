/**
 * File: p2p-kids-marketplace/src/components/molecules/ItemCard/index.tsx
 * MODULE-15.1-UI-REDESIGN: ItemCard Component
 * Task: FLOW-06 Discovery & Search - Grid Item Card
 *
 * 2-column grid card with Heart/Share overlay icons on image.
 * Designed for FlatList numColumns={2} with 12px gap.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Heart, HeartStraight, Share } from 'phosphor-react-native';
import { ListingImage } from '@/components/atoms';

interface ItemCardProps {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  isFavorite?: boolean;
  acceptsSwapPoints?: boolean;
  onPress: () => void;
  onFavoritePress?: () => void;
  onSharePress?: () => void;
  testID?: string;
}

export default function ItemCard({
  id,
  title,
  price,
  imageUrl,
  isFavorite = false,
  acceptsSwapPoints = false,
  onPress,
  onFavoritePress,
  onSharePress,
  testID,
}: ItemCardProps) {
  return (
    <Pressable
      testID={testID || `item-card-${id}`}
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${title}, $${price}`}
    >
      {/* Image with overlay icons */}
      <View style={styles.imageContainer}>
        <ListingImage
          url={imageUrl}
          containerStyle={styles.image}
          imageStyle={styles.image}
        />

        {/* Overlay action buttons - top-right */}
        <View style={styles.overlayActions}>
          {onFavoritePress && (
            <Pressable
              testID={`${testID || id}-favorite-button`}
              style={styles.overlayButton}
              onPress={onFavoritePress}
              hitSlop={8}
            >
              {isFavorite ? (
                <HeartStraight size={18} color="#5DBB8E" weight="fill" />
              ) : (
                <Heart size={18} color="#1A1A1A" weight="regular" />
              )}
            </Pressable>
          )}
          {onSharePress && (
            <Pressable
              testID={`${testID || id}-share-button`}
              style={styles.overlayButton}
              onPress={onSharePress}
              hitSlop={8}
            >
              <Share size={18} color="#1A1A1A" weight="regular" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Item details */}
      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>${price.toFixed(2)}</Text>
          {acceptsSwapPoints && <Text style={styles.spBadge}>SP ✓</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4, // Additional spacing for grid
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1, // Square images for grid
    backgroundColor: '#F0F0F0',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  overlayActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  overlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  details: {
    padding: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
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
});
