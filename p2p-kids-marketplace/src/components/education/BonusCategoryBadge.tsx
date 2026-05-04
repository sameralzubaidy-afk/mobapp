// FILE: p2p-kids-marketplace/src/components/education/BonusCategoryBadge.tsx
// MODULE-18 EDU-006: Bonus category badge component

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface BonusCategoryBadgeProps {
  iconUrl?: string | null;
  testID?: string;
}

export function BonusCategoryBadge({ iconUrl, testID }: BonusCategoryBadgeProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <View
      style={styles.badge}
      testID={testID}
      accessible={true}
      accessibilityLabel="Bonus category badge"
      accessibilityRole="image"
    >
      {iconUrl && !imageError ? (
        <Image
          source={{ uri: iconUrl }}
          style={styles.badgeImage}
          resizeMode="contain"
          testID={`${testID}-image`}
          onError={() => setImageError(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={styles.badgeIcon} testID={`${testID}-emoji`}>
          ⭐
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    minWidth: 24,
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeImage: {
    width: 16,
    height: 16,
  },
});
