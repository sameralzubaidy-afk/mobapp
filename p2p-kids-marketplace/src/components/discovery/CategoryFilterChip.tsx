/**
 * File: p2p-kids-marketplace/src/components/discovery/CategoryFilterChip.tsx
 * TASK ADMIN-V3-007: Category Filter Chip
 * Module: MODULE-12-ADMIN-V3-CATEGORIES
 * 
 * Renders a filter chip for categories in discovery/search flows.
 */

import React from 'react';
import { TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { BonusBadge } from '../shared/BonusBadge';

export interface CategoryFilterChipProps {
  /** Category ID */
  id: string;
  /** Category name */
  name: string;
  /** Category emoji icon */
  icon?: string | null;
  /** Custom category icon URL */
  icon_url?: string | null;
  /** Bonus badge icon URL */
  bonus_badge_icon_url?: string | null;
  /** SP earning multiplier (> 1.10 shows bonus badge) */
  sp_earning_multiplier?: number;
  /** Item count (currently informational only) */
  item_count?: number;
  /** Whether this chip is selected */
  selected?: boolean;
  /** Callback when chip is pressed */
  onPress?: (id: string) => void;
  /** Test ID */
  testID?: string;
}

export function CategoryFilterChip({
  id,
  name,
  icon,
  icon_url,
  bonus_badge_icon_url,
  sp_earning_multiplier,
  item_count: _itemCount,
  selected = false,
  onPress,
  testID = `category-chip-${id}`,
}: CategoryFilterChipProps) {
  const showBonusBadge = Number(sp_earning_multiplier ?? 1.1) > 1.1;

  const handlePress = () => {
    if (onPress) {
      onPress(id);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`Filter by category: ${name}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
    >
      {/* Icon */}
      {icon_url ? (
        <Image
          source={{ uri: icon_url }}
          style={styles.iconImage}
          resizeMode="cover"
        />
      ) : icon && icon.trim().length > 0 ? (
        <Text style={styles.iconText}>{icon}</Text>
      ) : (
        <Text style={styles.iconText}>📦</Text>
      )}

      {/* Name */}
      <Text style={[styles.name, selected && styles.nameSelected]}>{name}</Text>

      {/* Bonus Badge */}
      {showBonusBadge && (
        <BonusBadge
          iconUrl={bonus_badge_icon_url}
          size="small"
          style={styles.bonusBadge}
          testID={`${testID}-bonus`}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  iconImage: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginRight: 6,
  },
  iconText: {
    fontSize: 16,
    marginRight: 6,
  },
  name: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  nameSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  bonusBadge: {
    marginLeft: 4,
  },
});
