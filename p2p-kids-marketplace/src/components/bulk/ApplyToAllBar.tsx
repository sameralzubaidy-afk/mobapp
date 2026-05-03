/**
 * File: p2p-kids-marketplace/src/components/bulk/ApplyToAllBar.tsx
 * MODULE-04 V3.1 UX overhaul (Decision 5) — bulk apply shortcuts
 *
 * Sticky bar shown above the publish bar during the Review step. Surfaces a
 * single suggested value per supported field (the most common non-blank value
 * across items) and lets the seller propagate it to every included item with
 * one tap. Non-destructive by default — only fills blanks.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
  const suggestions = SUPPORTED_FIELDS.map((field) => ({
    ...field,
    value: suggestApplyValue(items, field.id),
  })).filter((entry) => entry.value !== null);

  if (suggestions.length === 0 || items.length < 2) return null;

  return (
    <View style={styles.bar} testID="apply-to-all-bar">
      <Text style={styles.title}>Apply to all included items:</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    // Keep chips above the fixed bottom submit bar in BulkListingCreateScreen.
    marginBottom: 86,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
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
    borderColor: '#FCD34D',
  },
  chipLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '700',
  },
  chipValue: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '600',
    maxWidth: 80,
  },
});
