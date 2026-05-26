// File: p2p-kids-marketplace/src/components/shared/StatusBadge.tsx
// MODULE-15.1: Listing / trade status badge component (D-012)
// Design: Active (green), Sold (gray), Expired (yellow), Pending (orange), Cancelled (red)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type StatusType = 'active' | 'sold' | 'expired' | 'pending' | 'cancelled' | 'completed' | 'processing';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  testID?: string;
}

const STATUS_CONFIG: Record<StatusType, { bg: string; text: string; label: string }> = {
  active:     { bg: '#E8F5F0', text: '#2D7D5A', label: 'Active' },
  sold:       { bg: '#F3F4F6', text: '#6B7280', label: 'Sold' },
  completed:  { bg: '#F3F4F6', text: '#6B7280', label: 'Completed' },
  expired:    { bg: '#FEF3C7', text: '#92400E', label: 'Expired' },
  pending:    { bg: '#FFF7ED', text: '#C2410C', label: 'Pending' },
  processing: { bg: '#FFF7ED', text: '#C2410C', label: 'Processing' },
  cancelled:  { bg: '#FFF0F2', text: '#BE185D', label: 'Cancelled' },
};

export function StatusBadge({ status, label, testID }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { bg: '#F3F4F6', text: '#6B7280', label: status };

  return (
    <View
      style={[styles.badge, { backgroundColor: config.bg }]}
      testID={testID}
      accessibilityLabel={`Status: ${label ?? config.label}`}
    >
      <Text style={[styles.text, { color: config.text }]}>
        {label ?? config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
