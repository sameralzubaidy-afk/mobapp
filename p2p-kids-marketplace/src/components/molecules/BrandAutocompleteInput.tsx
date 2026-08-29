/**
 * File: p2p-kids-marketplace/src/components/molecules/BrandAutocompleteInput.tsx
 * MODULE-04 LISTING-V3-009: Brand Autocomplete Input (reused from MODULE-05 V3)
 *
 * Autocomplete input for brand selection with:
 * - Debounced search (150ms)
 * - Predefined brands + database brands
 * - Max 8 suggestions
 * - Accessibility support
 *
 * Reuses:
 * - getBrandSuggestions from @/services/brandAutocomplete
 * - PREDEFINED_BRANDS (imported indirectly via service)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  type TextInputProps,
} from 'react-native';

import { getBrandSuggestions } from '@/services/brandAutocomplete';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export interface BrandAutocompleteInputProps extends Omit<TextInputProps, 'onChange' | 'value'> {
  value: string;
  onChange: (brand: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  testID?: string;
}

/**
 * Autocomplete input for brand selection
 *
 * Features:
 * - Debounced search (150ms) for performance
 * - Hybrid suggestions: predefined + database brands
 * - Max 8 suggestions displayed
 * - Touch outside to dismiss
 *
 * @example
 * <BrandAutocompleteInput
 *   value={brand}
 *   onChange={setBrand}
 *   label="Brand"
 *   placeholder="e.g., LEGO, Nike..."
 *   testID="brand-input"
 * />
 */
export function BrandAutocompleteInput({
  value,
  onChange,
  label,
  placeholder = 'Type brand name...',
  required = false,
  testID = 'brand-autocomplete',
  ...textInputProps
}: BrandAutocompleteInputProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced brand suggestions fetch
  useEffect(() => {
    const trimmed = query.trim();

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Return early if query too short
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getBrandSuggestions(trimmed);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('[BrandAutocompleteInput] Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 150); // 150ms debounce (MODULE-05 V3 recommendation)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    onChange(text);
  };

  const handleSelectSuggestion = (brand: string) => {
    setQuery(brand);
    onChange(brand);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleFocus = () => {
    if (query.trim().length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow suggestion tap to register
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <View style={styles.container} testID={testID}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View style={styles.inputContainer}>
        <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={label || 'Brand input'}
          testID={`${testID}-input`}
          {...textInputProps}
        />

        {isLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#5DBB8E" />
          </View>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsList} testID={`${testID}-suggestions-list`}>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                accessible
                key={`${item}-${index}`}
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item}`}
                testID={`${testID}-suggestion-${item.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    zIndex: 1000, // Ensure suggestions appear above other elements
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 0,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F0F0F0',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  suggestionsContainer: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsList: {
    width: '100%',
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#000000',
  },
});
