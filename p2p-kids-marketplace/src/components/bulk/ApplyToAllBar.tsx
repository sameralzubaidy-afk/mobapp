/**
 * File: p2p-kids-marketplace/src/components/bulk/ApplyToAllBar.tsx
 * MODULE-04 V3.1 UX overhaul (Decision 5) — bulk apply shortcuts
 *
 * Sticky bar shown above the publish bar during the Review step. Surfaces a
 * single suggested value per supported field (the most common non-blank value
 * across items) and lets the seller propagate it to every included item with
 * one tap. Non-destructive by default — only fills blanks.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { CaretDown, CaretUp } from 'phosphor-react-native';
import { ApplyToAllField, applyFieldToAll, suggestApplyValue } from '../../utils/bulkApplyToAll';
import { BulkEditableItem } from './BulkItemCard';

const SUPPORTED_FIELDS: { id: ApplyToAllField; label: string }[] = [
  { id: 'brand', label: 'Brand' },
  { id: 'condition', label: 'Condition' },
  { id: 'age_group', label: 'Age' },
  { id: 'gender', label: 'Gender' },
];

interface ApplyToAllBarProps {
  items: BulkEditableItem[];
  onApply: (next: BulkEditableItem[]) => void;
}

function renderValue(value: BulkEditableItem[ApplyToAllField]): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
}

export function ApplyToAllBar({ items, onApply }: ApplyToAllBarProps) {
  // Fix 4 (UX): collapsed by default — a single tappable "Apply all" row that
  // expands to reveal the per-field suggestion chips, freeing vertical space
  // on the Review step where the fixed Submit bar crowds the bottom.
  const [expanded, setExpanded] = useState(false);

  const suggestions = SUPPORTED_FIELDS.map((field) => ({
    ...field,
    value: suggestApplyValue(items, field.id),
  })).filter((entry) => entry.value !== null);

  if (suggestions.length === 0 || items.length < 2) return null;

  return (
    <View style={styles.bar} testID="apply-to-all-bar">
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setExpanded((value) => !value)}
        accessible
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded ? 'Collapse apply to all options' : 'Apply the same value to all included items'
        }
        testID="apply-to-all-toggle"
      >
        <Text style={styles.title}>Apply all</Text>
        {expanded ? (
          <CaretUp size={18} color="#065F46" weight="bold" />
        ) : (
          <CaretDown size={18} color="#065F46" weight="bold" />
        )}
      </TouchableOpacity>
      {expanded && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {suggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.chip}
              onPress={() => onApply(applyFieldToAll(items, suggestion.id, suggestion.value))}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Apply ${suggestion.label} ${renderValue(suggestion.value)} to all included items`}
              testID={`apply-to-all-${suggestion.id}`}
            >
              <Text style={styles.chipLabel}>{suggestion.label}</Text>
              <Text style={styles.chipValue} numberOfLines={1}>
                {renderValue(suggestion.value)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#ECFDF5',
    borderTopWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    // Keep this panel fully above the fixed Submit bar in BulkListingCreateScreen
    // (BulkPublishBar now floats at bottom:120 with ~72px height → top ≈192pt)
    // AND the floating pill nav, so it is never partially hidden behind them.
    marginBottom: 200,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  row: {
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#5DBB8E',
  },
  chipLabel: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
  },
  chipValue: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '600',
    maxWidth: 80,
  },
});
