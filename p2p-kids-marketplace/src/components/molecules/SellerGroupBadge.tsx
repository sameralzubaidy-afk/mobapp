/**
 * File: p2p-kids-marketplace/src/components/molecules/SellerGroupBadge.tsx
 *
 * SELLER-GROUP-002: Anonymous Seller Group Badge
 *
 * Renders a colored badge that identifies which seller group an item belongs to,
 * without revealing the seller's name, avatar, or location.
 *
 * The badge shows a colored dot + label like "Seller ● Blue".
 * The color is deterministically derived from the seller_id hash.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SellerGroupBadgeProps {
  /** Hex color from getSellerGroup() */
  color: string;
  /** Label from getSellerGroup() */
  label: string;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Optional test ID */
  testID?: string;
}

export default function SellerGroupBadge({
  color,
  label,
  size = 'medium',
  testID,
}: SellerGroupBadgeProps) {
  const dotSize = size === 'small' ? 8 : 10;
  const fontSize = size === 'small' ? 11 : 12;

  return (
    <View style={styles.container} testID={testID || 'seller-group-badge'}>
      <View
        style={[
          styles.dot,
          { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
        ]}
      />
      <Text style={[styles.label, { fontSize, color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  dot: {
    flexShrink: 0,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
