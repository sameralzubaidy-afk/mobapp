/**
 * File: p2p-kids-marketplace/src/components/molecules/MatchesCartBadge.tsx
 *
 * SELLER-GROUP-004: "Matches Your Cart" Indicator
 *
 * Displayed on item cards and ItemDetailScreen when the item's seller group
 * matches the buyer's active cart seller group. Signals to the buyer that
 * this item can be added without triggering the different-seller conflict.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShoppingCart } from 'phosphor-react-native';

interface MatchesCartBadgeProps {
  size?: 'small' | 'medium';
  testID?: string;
}

export default function MatchesCartBadge({
  size = 'medium',
  testID,
}: MatchesCartBadgeProps) {
  const iconSize = size === 'small' ? 12 : 14;
  const fontSize = size === 'small' ? 10 : 12;

  return (
    <View style={styles.container} testID={testID || 'matches-cart-badge'}>
      <ShoppingCart size={iconSize} color="#5DBB8E" weight="fill" />
      <Text style={[styles.label, { fontSize }]}>Matches Your Trade Basket</Text>
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
    backgroundColor: '#EEF9F4',
    alignSelf: 'flex-start',
  },
  label: {
    color: '#5DBB8E',
    fontWeight: '600',
  },
});
