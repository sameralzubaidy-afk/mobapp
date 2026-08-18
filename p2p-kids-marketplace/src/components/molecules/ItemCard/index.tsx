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
import { ListingImage, AcceptsSpBadge } from '@/components/atoms';
import { ds, dsRadii, dsShadowL1, dsType } from '@/theme/discoveryTokens';

interface ItemCardProps {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  isFavorite?: boolean;
  acceptsSwapPoints?: boolean;
  /** P4 (2026-08-17): render an "Other Node" badge (item belongs to a different node than the viewer). */
  otherNode?: boolean;
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
  otherNode = false,
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
        <ListingImage url={imageUrl} containerStyle={styles.image} imageStyle={styles.image} />

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
        {otherNode && (
          <View
            style={styles.otherNodeBadge}
            testID={`${testID || id}-other-node-badge`}
            accessible
            accessibilityRole="text"
            accessibilityLabel="Other Node"
          >
            <Text style={styles.otherNodeBadgeText}>Other Node</Text>
          </View>
        )}
        <View style={styles.priceRow}>
          <Text style={styles.price}>${price.toFixed(2)}</Text>
          {acceptsSwapPoints && <AcceptsSpBadge testID={`${testID || id}-sp-badge`} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: ds.neutral.white,
    borderRadius: dsRadii.large, // 16 — design-system §6.2 Item Card
    ...dsShadowL1,
    marginBottom: 4, // Additional spacing for grid
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1, // Square images for grid
    backgroundColor: ds.neutral[100],
    // Clip the image corners here (not via card overflow:hidden) so the card
    // can still render its Level-1 shadow (overflow:hidden clips shadows).
    borderTopLeftRadius: dsRadii.large,
    borderTopRightRadius: dsRadii.large,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
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
    padding: 12,
    backgroundColor: ds.neutral.white,
    borderBottomLeftRadius: dsRadii.large,
    borderBottomRightRadius: dsRadii.large,
  },
  title: {
    fontSize: dsType.h4.fontSize,
    lineHeight: dsType.h4.lineHeight,
    fontWeight: dsType.h4.fontWeight, // H4 (18/24/600) — design-system §6.2
    color: ds.neutral[900],
    marginBottom: 4,
  },
  otherNodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ds.neutral[100],
    borderRadius: dsRadii.small,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  otherNodeBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: ds.neutral[500],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    fontSize: 16, // Body Large
    lineHeight: 24,
    fontWeight: '700', // Body Large 700 — design-system §6.2
    color: ds.neutral[900],
  },
});
