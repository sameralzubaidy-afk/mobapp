/**
 * File: p2p-kids-marketplace/src/components/shared/BonusBadge.tsx
 * TASK ADMIN-V3-007: Bonus Badge Component
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 *
 * Renders a bonus badge (custom icon or ⭐ emoji fallback)
 * for categories with sp_earning_multiplier > 1.10
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';

export interface BonusBadgeProps {
  /** Custom bonus badge icon URL from Supabase Storage */
  iconUrl?: string | null;
  /** Size of the badge (small, medium, large) */
  size?: 'small' | 'medium' | 'large';
  /** Custom style override */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

export function BonusBadge({
  iconUrl,
  size = 'small',
  style,
  testID = 'bonus-badge',
}: BonusBadgeProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    // Reset image fallback state when the icon URL changes.
    setImageLoadFailed(false);
  }, [iconUrl]);

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large,
  };

  const imageSizeStyles = {
    small: styles.imageSmall,
    medium: styles.imageMedium,
    large: styles.imageLarge,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  // If custom icon URL is provided, use Image component with expo-image
  if (iconUrl && iconUrl.trim().length > 0 && !imageLoadFailed) {
    return (
      <View style={[sizeStyles[size], style]} testID={testID}>
        <Image
          source={{ uri: iconUrl }}
          style={imageSizeStyles[size]}
          resizeMode="cover"
          onError={() => setImageLoadFailed(true)}
          accessibilityLabel="Bonus category badge"
        />
      </View>
    );
  }

  // Fallback to ⭐ emoji
  return (
    <View style={[sizeStyles[size], style]} testID={`${testID}-fallback`}>
      <Text style={textSizeStyles[size]} accessibilityLabel="Bonus category badge">
        ⭐
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container sizes
  small: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medium: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  large: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Image sizes
  imageSmall: {
    width: 16,
    height: 16,
  },
  imageMedium: {
    width: 24,
    height: 24,
  },
  imageLarge: {
    width: 32,
    height: 32,
  },

  // Text (emoji) sizes
  textSmall: {
    fontSize: 14,
    lineHeight: 16,
  },
  textMedium: {
    fontSize: 20,
    lineHeight: 24,
  },
  textLarge: {
    fontSize: 28,
    lineHeight: 32,
  },
});
