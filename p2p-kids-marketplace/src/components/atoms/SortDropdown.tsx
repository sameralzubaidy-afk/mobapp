import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SortOption } from '@/types/discovery';

type SortDropdownProps = {
  value: SortOption;
  onChange: (next: SortOption) => void;
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    return SORT_OPTIONS.find((option) => option.value === value)?.label ?? 'Relevance';
  }, [value]);

  const handleSelect = (nextValue: SortOption) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <Pressable
        testID="discover-sort-button"
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${selectedLabel}`}
        accessibilityState={{ expanded: isOpen }}
        style={styles.sortButton}
        onPress={() => setIsOpen((prev) => !prev)}
      >
        <Text style={styles.sortButtonText}>Sort: {selectedLabel}</Text>
      </Pressable>

      {isOpen && (
        <View style={styles.dropdown} testID="sort-dropdown-options">
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.value === value;

            return (
              <Pressable
                key={option.value}
                testID={`sort-option-${option.value}`}
                accessibilityRole="button"
                accessibilityLabel={`Sort option ${option.label}`}
                accessibilityState={{ selected: isSelected }}
                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                onPress={() => handleSelect(option.value)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    zIndex: 20,
  },
  sortButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d0d0d0',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
  },
  sortButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 4,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#eef6ff',
  },
  optionText: {
    color: '#1f2937',
    fontSize: 14,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
