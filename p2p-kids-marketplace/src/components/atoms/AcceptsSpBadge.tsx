/**
 * File: p2p-kids-marketplace/src/components/atoms/AcceptsSpBadge.tsx
 * DISCOVER-REDESIGN: "Accepts SP" badge pill (design-system.md §6.7 SP Badge)
 *
 * Shows that a listing's seller has enabled swap-point acceptance.
 * Distinct from the shared `SPBadge` (which renders a points value like "+250 SP").
 * Tokens: SP-100 bg, 1px SP-500 border, radius 12 (pill 999 for the small grid
 * variant keeps it compact), 16px SP-500 coin icon, Label-type SP-500 text.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Coins } from 'phosphor-react-native';
import { ds, dsRadii } from '@/theme/discoveryTokens';

interface AcceptsSpBadgeProps {
  /** 'small' fits the 2-column ItemCard; 'medium' suits wider surfaces. */
  size?: 'small' | 'medium';
  testID?: string;
}

export default function AcceptsSpBadge({ size = 'small', testID }: AcceptsSpBadgeProps) {
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall]} testID={testID}>
      <Coins size={isSmall ? 14 : 16} color={ds.sp[500]} weight="fill" />
      <Text style={[styles.text, isSmall && styles.textSmall]}>Accepts SP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.sp[100],
    borderWidth: 1,
    borderColor: ds.sp[500],
    borderRadius: dsRadii.medium, // 12 (design-system §6.7 SP Badge)
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    borderRadius: dsRadii.pill, // compact pill on the small grid card
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: ds.sp[500],
  },
  textSmall: {
    fontSize: 11,
  },
});
