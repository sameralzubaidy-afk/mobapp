// FILE: p2p-kids-marketplace/src/components/education/BonusCategoryBadge.tsx
// MODULE-18 EDU-006: Bonus category badge component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BonusCategoryBadgeProps {
  iconUrl?: string | null;
  testID?: string;
}

export function BonusCategoryBadge({ iconUrl, testID }: BonusCategoryBadgeProps) {
  return (
    <View
      style={styles.badge}
      testID={testID}
      accessible={true}
      accessibilityLabel="Bonus category badge"
      accessibilityRole="image"
    >
      <Text style={styles.badgeIcon}>{iconUrl ? '🏆' : '⭐'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  badgeIcon: {
    fontSize: 12,
  },
});
