/**
 * File: p2p-kids-marketplace/src/components/listing/GenderSelector.tsx
 * MODULE-04 LISTING-V3-008: Gender Selector
 * Task: LISTING-V3-008 - 4 pills for gender selection
 *
 * Features:
 * - 4 options: boy, girl, unisex, Any (maps to null)
 * - Single select pill buttons
 * - Values match MODULE-05 V3 enum
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Gender = 'boy' | 'girl' | 'unisex';

const GENDER_OPTIONS: { value: Gender | null; label: string }[] = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'unisex', label: 'Unisex' },
  { value: null, label: 'Any' },
];

export interface GenderSelectorProps {
  value: Gender | null;
  onChange: (gender: Gender | null) => void;
  testID?: string;
}

export function GenderSelector({
  value,
  onChange,
  testID = 'gender-selector',
}: GenderSelectorProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>Gender</Text>

      <View style={styles.pillsContainer}>
        {GENDER_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          const optionKey = option.value || 'any';

          return (
            <TouchableOpacity
              key={optionKey}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => onChange(option.value)}
              accessibilityLabel={`Gender: ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              testID={`gender-${optionKey}`}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#F5F5F5',
  },
  pillSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  pillTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
