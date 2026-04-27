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
          accessibilityLabel="Merge selected photos into one item"
          testID="selection-merge"
        >
          <Text style={[styles.btnText, !canMerge && styles.btnTextDisabled]}>Merge</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMoveToNew}
          style={styles.btn}
          accessibilityLabel="Move selected photos into a new item"
          testID="selection-move-to-new"
        >
          <Text style={styles.btnText}>New item</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={[styles.btn, styles.btnDanger]}
          accessibilityLabel="Delete selected photos"
          testID="selection-delete"
        >
          <Text style={[styles.btnText, styles.btnTextDanger]}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClear}
          style={styles.btn}
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    backgroundColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnDanger: {
    backgroundColor: '#7F1D1D',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  btnTextDisabled: {
    color: '#D1D5DB',
  },
  btnTextDanger: {
    color: '#FECACA',
  },
});
