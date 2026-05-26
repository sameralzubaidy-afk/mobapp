// File: p2p-kids-marketplace/src/components/shared/SPBadge.tsx
// MODULE-15.1: Swap Points badge component (D-011)
// Design: #FEF3C7 background, #F59E0B gold text, Coins icon

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Coins } from 'phosphor-react-native';

interface SPBadgeProps {
  points: number;
  prefix?: string;
  size?: 'small' | 'medium';
  testID?: string;
}

export function SPBadge({ points, prefix = '', size = 'medium', testID }: SPBadgeProps) {
  const iconSize = size === 'small' ? 12 : 16;
  const fontSize = size === 'small' ? 11 : 13;

  return (
    <View style={[styles.badge, size === 'small' && styles.badgeSmall]} testID={testID}>
      <Coins size={iconSize} color="#F59E0B" weight="fill" />
      <Text style={[styles.text, { fontSize }]}>
        {prefix}{points} SP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    // WCAG AA: #78350F on #FEF3C7 = 8.15:1 ✅
    color: '#78350F',
    fontWeight: '600',
  },
});
