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
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Import COLOR_PALETTE from MODULE-05 V3 types (LISTING-V3-009 - reuse shared constants)
import { COLOR_PALETTE } from '@/types/discovery';

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
  const handleToggleColor = (colorId: string) => {
    const isSelected = selectedColors.includes(colorId);

    if (isSelected) {
      // Remove color
      onChange(selectedColors.filter((c) => c !== colorId));
    } else {
      // Add color (respect max limit)
      if (selectedColors.length < maxColors) {
        onChange([...selectedColors, colorId]);
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
          const isSelected = selectedColors.includes(color.id);

          const isMulticolor = color.id === 'multicolor';

          return (
            <TouchableOpacity
              accessible
              key={color.id}
              style={[styles.swatch, isSelected && styles.swatchSelected]}
              onPress={() => handleToggleColor(color.id)}
              accessibilityLabel={`${color.label} color`}
              // BP-53: accessibilityRole="checkbox" does not register in the iOS
              // AX tree on RN 0.81 — use "button" + selected state, mirroring the
              // other selectable pills (AgeGroupSelector / GenderSelector).
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              testID={`color-${color.id}`}
            >
              <View
                style={[
                  styles.swatchInner,
                  {
                    backgroundColor: isMulticolor ? '#FFFFFF' : color.hex,
                    borderWidth: isSelected ? 2 : color.id === 'white' || isMulticolor ? 1 : 0,
                    borderColor: isSelected ? '#5DBB8E' : '#E0E0E0',
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

              <Text style={styles.swatchLabel}>{color.label}</Text>
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  count: {
    fontSize: 14,
    color: '#6B6B6B',
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
    transform: [{ scale: 1.03 }],
  },
  swatchInner: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  checkMark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  swatchLabel: {
    fontSize: 11,
    color: '#6B6B6B',
    marginTop: 4,
    textAlign: 'center',
  },
  limitText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
  },
});
