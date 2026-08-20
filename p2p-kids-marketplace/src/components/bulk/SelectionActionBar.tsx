/**
 * File: p2p-kids-marketplace/src/components/bulk/SelectionActionBar.tsx
 * MODULE-04 V3.1 UX overhaul (Decision 4) — bottom action bar shown when
 * the user is in multi-select photo mode.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SelectionActionBarProps {
  selectedCount: number;
  canMerge: boolean;
  onMerge: () => void;
  onMoveToNew: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function SelectionActionBar({
  selectedCount,
  canMerge,
  onMerge,
  onMoveToNew,
  onDelete,
  onClear,
}: SelectionActionBarProps) {
  if (selectedCount === 0) return null;
  return (
    <View style={styles.bar} testID="selection-action-bar">
      <Text style={styles.count}>{selectedCount} selected</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onMerge}
          disabled={!canMerge}
          style={[styles.btn, !canMerge && styles.btnDisabled]}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: !canMerge }}
          accessibilityLabel="Merge selected photos into one item"
          testID="selection-merge"
        >
          <Text style={[styles.btnText, !canMerge && styles.btnTextDisabled]}>Merge</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMoveToNew}
          style={styles.btn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Move selected photos into a new item"
          testID="selection-move-to-new"
        >
          <Text style={styles.btnText}>New item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={[styles.btn, styles.btnDanger]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Delete selected photos"
          testID="selection-delete"
        >
          <Text style={[styles.btnText, styles.btnTextDanger]}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClear}
          style={styles.btn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Clear selection"
          testID="selection-clear"
        >
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    // Clear the floating pill nav (PersistentTabBar overlays the stack): same
    // bottom:120 clearance CartScreen's sticky bar uses so the selection
    // actions are never hidden behind the pill during the grouping step.
    bottom: 120,
    left: 0,
    right: 0,
    backgroundColor: '#F5FAF7',
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    minHeight: 40,
    backgroundColor: '#E8F5F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#E85D75',
  },
  btnText: {
    color: '#065F46',
    fontWeight: '600',
    fontSize: 13,
  },
  btnTextDisabled: {
    color: '#9CA3AF',
  },
  btnTextDanger: {
    color: '#E85D75',
  },
});
