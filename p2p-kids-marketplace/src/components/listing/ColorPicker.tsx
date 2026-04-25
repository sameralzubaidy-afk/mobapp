/**
 * File: p2p-kids-marketplace/src/components/listing/ColorPicker.tsx
 * MODULE-04 LISTING-V3-008: Color Picker
 * Task: LISTING-V3-008 - 12-swatch multi-select color picker
 * 
 * Features:
 * - 12 predefined colors from MODULE-05 V3
 * - Multi-select with check marks
 * - Accessibility state for selected colors
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

// Import COLOR_PALETTE from MODULE-05 V3 types
// TODO: Update import path if discovery.ts is in a different location
const COLOR_PALETTE = [
  { name: 'Red', hex: '#F44336' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Purple', hex: '#9C27B0' },
  { name: 'Blue', hex: '#2196F3' },
  { name: 'Green', hex: '#4CAF50' },
  { name: 'Yellow', hex: '#FFEB3B' },
  { name: 'Orange', hex: '#FF9800' },
  { name: 'Brown', hex: '#795548' },
  { name: 'Gray', hex: '#9E9E9E' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Multicolor', hex: 'linear-gradient' }, // Special case
];

export interface ColorPickerProps {
  selectedColors: string[];
  onChange: (colors: string[]) => void;
  maxColors?: number;
  testID?: string;
}

export function ColorPicker({
  selectedColors,
  onChange,
  maxColors = 3,
  testID = 'color-picker',
}: ColorPickerProps) {
  const handleToggleColor = (colorName: string) => {
    const isSelected = selectedColors.includes(colorName);

    if (isSelected) {
      // Remove color
      onChange(selectedColors.filter((c) => c !== colorName));
    } else {
      // Add color (respect max limit)
      if (selectedColors.length < maxColors) {
        onChange([...selectedColors, colorName]);
      }
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>Colors</Text>
        <Text style={styles.count}>
          {selectedColors.length}/{maxColors} selected
        </Text>
      </View>

      <View style={styles.grid}>
        {COLOR_PALETTE.map((color) => {
          const isSelected = selectedColors.includes(color.name);
          const isMulticolor = color.name === 'Multicolor';

          return (
            <TouchableOpacity
              key={color.name}
              style={[styles.swatch, isSelected && styles.swatchSelected]}
              onPress={() => handleToggleColor(color.name)}
              accessibilityLabel={`${color.name} color`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              testID={`color-${color.name.toLowerCase()}`}
            >
              <View
                style={[
                  styles.swatchInner,
                  {
                    backgroundColor: isMulticolor ? '#FFFFFF' : color.hex,
                    borderWidth: color.name === 'White' || isMulticolor ? 1 : 0,
                    borderColor: '#E0E0E0',
                  },
                ]}
              >
                {isMulticolor && (
                  <View style={styles.multicolorStripes}>
                    <View style={[styles.stripe, { backgroundColor: '#F44336' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#FFEB3B' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#4CAF50' }]} />
                    <View style={[styles.stripe, { backgroundColor: '#2196F3' }]} />
                  </View>
                )}

                {isSelected && (
                  <View style={styles.checkContainer}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.swatchLabel}>{color.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedColors.length === maxColors && (
        <Text style={styles.limitText}>Maximum {maxColors} colors</Text>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  count: {
    fontSize: 14,
    color: '#666666',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: '22%',
    aspectRatio: 1,
    alignItems: 'center',
  },
  swatchSelected: {
    transform: [{ scale: 1.05 }],
  },
  swatchInner: {
    width: '100%',
    height: '80%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  multicolorStripes: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  stripe: {
    flex: 1,
  },
  checkContainer: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  checkMark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  swatchLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  limitText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
