// File: p2p-kids-marketplace/src/components/shared/SearchBar.tsx
// MODULE-15.1: Pill-shaped search bar (D-015)
// Design: 48px height, borderRadius 24, filled #F0F0F0, MagnifyingGlass icon

import React from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { MagnifyingGlass, X } from 'phosphor-react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  containerStyle?: ViewStyle;
  testID?: string;
}

export function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search items…',
  autoFocus = false,
  containerStyle,
  testID,
}: SearchBarProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <MagnifyingGlass size={20} color="#999999" weight="regular" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        style={styles.input}
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
        testID={testID ?? 'search-bar-input'}
        accessibilityLabel={placeholder}
        accessibilityRole="search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={onClear ?? (() => onChangeText(''))}
          hitSlop={8}
          testID="search-bar-clear"
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <X size={18} color="#999999" weight="regular" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    height: '100%',
  },
});
