/**
 * File: p2p-kids-marketplace/src/components/listing/AgeGroupSelector.tsx
 * MODULE-04 LISTING-V3-008: Age Group Selector
 * Task: LISTING-V3-008 - 5 pills for age group selection
 *
 * Features:
 * - 5 age group options (0-2, 3-5, 6-8, 9-12, 13+)
 * - Single select pill buttons
 * - Values match MODULE-05 V3 enum
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type AgeGroup = '0-2' | '3-5' | '6-8' | '9-12' | '13+';

const AGE_GROUPS: Array<{ value: AgeGroup; label: string }> = [
  { value: '0-2', label: '0-2 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '6-8', label: '6-8 years' },
  { value: '9-12', label: '9-12 years' },
  { value: '13+', label: '13+ years' },
];

export interface AgeGroupSelectorProps {
  value: AgeGroup | null;
  onChange: (ageGroup: AgeGroup | null) => void;
  testID?: string;
}

export function AgeGroupSelector({
  value,
  onChange,
  testID = 'age-group-selector',
}: AgeGroupSelectorProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>Age Group</Text>

      <View style={styles.pillsContainer}>
        {AGE_GROUPS.map((ageGroup) => {
          const isSelected = value === ageGroup.value;

          return (
            <TouchableOpacity
              key={ageGroup.value}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => onChange(isSelected ? null : ageGroup.value)}
              accessibilityLabel={`Age group: ${ageGroup.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              testID={`age-group-${ageGroup.value}`}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {ageGroup.label}
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
    paddingHorizontal: 16,
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
