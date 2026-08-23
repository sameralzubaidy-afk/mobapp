// File: p2p-kids-marketplace/src/components/EmptyState.tsx
// FLOW-26 Screen 3/6: Generic Empty State Component

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  testID = 'empty-state',
}) => {
  return (
    <View style={styles.container} testID={testID}>
      {icon && <View testID={`${testID}-icon`}>{icon}</View>}

      <Text style={styles.title} testID={`${testID}-title`}>
        {title}
      </Text>

      {subtitle && (
        <Text style={styles.subtitle} testID={`${testID}-subtitle`}>
          {subtitle}
        </Text>
      )}

      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          accessible
          testID={`${testID}-action-button`}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default EmptyState;
