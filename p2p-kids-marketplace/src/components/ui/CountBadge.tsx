/**
 * File: p2p-kids-marketplace/src/components/ui/CountBadge.tsx
 *
 * Single shared numeric count badge used across the app chrome:
 *   - Header notification bell
 *   - Header chat / messages icon
 *   - Trades tab (bottom nav)
 *   - Basket tab (bottom nav)
 *
 * Each instance is fed its own count source (unread notifications, unread
 * messages, active trades, basket items respectively) — there is exactly ONE
 * badge implementation, not four.
 *
 * Design system: error token background, pill radius, 99+ cap.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius } from '@/theme';

export interface CountBadgeProps {
  /** Numeric count to display. Values <= 0 render nothing. */
  count: number;
  /** Absolute offset from the top of the wrapping icon container. Default: -6. */
  top?: number;
  /** Absolute offset from the right of the wrapping icon container. Default: -10. */
  right?: number;
  /** Adds a white ring around the badge (header icons sit on tinted circles). */
  withRing?: boolean;
  /** Optional testID for automation. */
  testID?: string;
}

/**
 * Renders a small red numbered bubble, or null when count <= 0.
 * Caps display at "99+".
 */
export default function CountBadge({
  count,
  top = -6,
  right = -10,
  withRing = false,
  testID,
}: CountBadgeProps) {
  if (!count || count <= 0) {
    return null;
  }

  const label = count > 99 ? '99+' : String(count);

  return (
    <View
      style={[styles.badge, { top, right }, withRing && styles.ring]}
      testID={testID}
    >
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    minWidth: 18,
    height: 18,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.error[500],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  ring: {
    borderWidth: 1.5,
    borderColor: colors.neutral.white,
  },
  badgeText: {
    color: colors.neutral.white,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
