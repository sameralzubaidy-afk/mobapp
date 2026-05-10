/**
 * File: p2p-kids-marketplace/src/components/listing/ConditionSelector.tsx
 * MODULE-04 LISTING-V3-008: Condition Selector
 * Task: LISTING-V3-008 - 5 radio rows with photo guide button
 *
 * Features:
 * - 5 condition options (new, like_new, good, fair, worn)
 * - Photo guide button per condition
 * - Radio button selection
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera } from 'phosphor-react-native';
import { Condition } from '../../types/listing';

const CONDITIONS: { value: Condition; label: string; description: string }[] = [
  { value: 'new', label: 'New', description: 'Brand new with tags' },
  { value: 'like_new', label: 'Like New', description: 'Excellent condition, barely used' },
  { value: 'good', label: 'Good', description: 'Gently used, minor wear' },
  { value: 'fair', label: 'Fair', description: 'Noticeable wear, fully functional' },
  { value: 'worn', label: 'Worn', description: 'Heavy wear, still usable' },
];

export interface ConditionSelectorProps {
  value: Condition | null;
  onChange: (condition: Condition) => void;
  onOpenGuide: (condition: Condition) => void;
  testID?: string;
}

export function ConditionSelector({
  value,
  onChange,
  onOpenGuide,
  testID = 'condition-selector',
}: ConditionSelectorProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>Condition</Text>

      {CONDITIONS.map((condition) => {
        const isSelected = value === condition.value;

        return (
          <View key={condition.value} style={styles.row}>
            <TouchableOpacity
              style={styles.radioContainer}
              onPress={() => onChange(condition.value)}
              accessibilityLabel={`Select condition: ${condition.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              testID={`condition-${condition.value}`}
            >
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected && <View style={styles.radioSelected} />}
              </View>

              <View style={styles.labelContainer}>
                <Text style={styles.label}>{condition.label}</Text>
                <Text style={styles.description}>{condition.description}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guideButton}
              onPress={() => onOpenGuide(condition.value)}
              accessibilityLabel={`View photo guide for ${condition.label}`}
              accessibilityRole="button"
              testID={`guide-${condition.value}`}
            >
              <Camera
                size={20}
                color="#6B6B6B"
                weight="regular"
                testID={`guide-icon-${condition.value}`}
              />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  radioContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6B6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#5DBB8E',
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5DBB8E',
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  guideButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
