/**
 * File: p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx
 * MODULE-05-DISCOVERY-V3: Search Filter Modal
 * Task: DISCOVERY-V3-006
 * 
 * Bottom-sheet modal exposing all 8 filter sections in the exact order
 * defined in SEARCH-FILTER-REQUIREMENTS.md § Component Specifications.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Pressable,
} from 'react-native';
import { DiscoveryFilters, SortOption, COLOR_PALETTE, PRICE_PRESETS } from '@/types/discovery';
import { getDefaultFilters, validatePriceRange, countActiveFilters } from '@/utils/filterHelpers';
import { getBrandSuggestions } from '@/services/brandAutocomplete';

interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
}

interface SearchFilterModalProps {
  visible: boolean;
  filters: DiscoveryFilters;
  categories: Category[];
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;
}

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'worn', label: 'Worn' },
] as const;

const AGE_GROUP_OPTIONS = [
  { value: '0-2', label: '0-2' },
  { value: '3-5', label: '3-5' },
  { value: '6-8', label: '6-8' },
  { value: '9-12', label: '9-12' },
  { value: '13+', label: '13+' },
] as const;

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'unisex', label: 'Unisex' },
  { value: undefined, label: 'Any' },
] as const;

export const SearchFilterModal: React.FC<SearchFilterModalProps> = ({
  visible,
  filters,
  categories,
  onApply,
  onClose,
}) => {
  // Local draft state - changes only apply on "Apply Filters"
  const [draft, setDraft] = useState<DiscoveryFilters>(filters);
  
  // Brand autocomplete state
  const [brandQuery, setBrandQuery] = useState('');
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  // Price validation error
  const [priceError, setPriceError] = useState<string | null>(null);

  // Reset draft state when modal opens
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setBrandQuery(filters.brand || '');
      setPriceError(null);
    }
  }, [visible, filters]);

  // Brand autocomplete with debounce
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (brandQuery.length >= 2) {
        const suggestions = await getBrandSuggestions(brandQuery);
        setBrandSuggestions(suggestions);
        setShowBrandDropdown(suggestions.length > 0);
      } else {
        setBrandSuggestions([]);
        setShowBrandDropdown(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [brandQuery]);

  // Validate price range whenever min or max changes
  useEffect(() => {
    const isValid = validatePriceRange(draft.minPrice, draft.maxPrice);
    if (!isValid) {
      setPriceError('Min price must not exceed max price');
    } else {
      setPriceError(null);
    }
  }, [draft.minPrice, draft.maxPrice]);

  const handleClearAll = useCallback(() => {
    setDraft(getDefaultFilters());
    setBrandQuery('');
    setPriceError(null);
  }, []);

  const handleApply = useCallback(() => {
    if (priceError) {
      return; // Don't apply if validation fails
    }
    onApply(draft);
    onClose();
  }, [draft, priceError, onApply, onClose]);

  const toggleCategory = useCallback((categoryId: string) => {
    setDraft(prev => {
      const currentIds = prev.categoryIds || [];
      const isSelected = currentIds.includes(categoryId);
      
      return {
        ...prev,
        categoryIds: isSelected
          ? currentIds.filter(id => id !== categoryId)
          : [...currentIds, categoryId],
      };
    });
  }, []);

  const selectCondition = useCallback((condition: typeof CONDITION_OPTIONS[number]['value']) => {
    setDraft(prev => ({
      ...prev,
      condition: prev.condition === condition ? undefined : condition,
    }));
  }, []);

  const selectAgeGroup = useCallback((ageGroup: typeof AGE_GROUP_OPTIONS[number]['value']) => {
    setDraft(prev => ({
      ...prev,
      ageGroup: prev.ageGroup === ageGroup ? undefined : ageGroup,
    }));
  }, []);

  const selectGender = useCallback((gender: typeof GENDER_OPTIONS[number]['value']) => {
    setDraft(prev => ({
      ...prev,
      gender: prev.gender === gender ? undefined : gender,
    }));
  }, []);

  const toggleColor = useCallback((colorId: string) => {
    setDraft(prev => {
      const currentColors = prev.colors || [];
      const isSelected = currentColors.includes(colorId);
      
      return {
        ...prev,
        colors: isSelected
          ? currentColors.filter(c => c !== colorId)
          : [...currentColors, colorId],
      };
    });
  }, []);

  const selectBrand = useCallback((brand: string) => {
    setDraft(prev => ({ ...prev, brand }));
    setBrandQuery(brand);
    setShowBrandDropdown(false);
  }, []);

  const handleBrandInputChange = useCallback((text: string) => {
    setBrandQuery(text);
    setDraft(prev => ({ ...prev, brand: text || undefined }));
  }, []);

  const selectPricePreset = useCallback((preset: typeof PRICE_PRESETS[number]) => {
    setDraft(prev => ({
      ...prev,
      minPrice: preset.min,
      maxPrice: preset.max,
    }));
  }, []);

  const setMinPrice = useCallback((text: string) => {
    const value = text ? parseFloat(text) : undefined;
    setDraft(prev => ({ ...prev, minPrice: value }));
  }, []);

  const setMaxPrice = useCallback((text: string) => {
    const value = text ? parseFloat(text) : undefined;
    setDraft(prev => ({ ...prev, maxPrice: value }));
  }, []);

  const toggleSP = useCallback((value: boolean) => {
    setDraft(prev => ({ ...prev, spEligibleOnly: value }));
  }, []);

  const activeCount = countActiveFilters(draft);
  const canApply = !priceError;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>
              Filters {activeCount > 0 && `(${activeCount})`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleClearAll}
              accessibilityLabel="Clear all filters"
              testID="filter-modal-clear-all"
            >
              <Text style={styles.clearButton}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close filter modal"
              testID="filter-modal-close"
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Section 1: Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CATEGORY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {categories.map(category => {
                const isSelected = draft.categoryIds?.includes(category.id);
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => toggleCategory(category.id)}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Category: ${category.name}`}
                    testID={`filter-category-${category.id}`}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Section 2: Condition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONDITION</Text>
            <View style={styles.pillRow}>
              {CONDITION_OPTIONS.map(option => {
                const isSelected = draft.condition === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => selectCondition(option.value)}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Condition: ${option.label}`}
                    testID={`filter-condition-${option.value}`}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 3: Age Group */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AGE GROUP</Text>
            <View style={styles.pillRow}>
              {AGE_GROUP_OPTIONS.map(option => {
                const isSelected = draft.ageGroup === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => selectAgeGroup(option.value)}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Age group: ${option.label}`}
                    testID={`filter-age-${option.value}`}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 4: Gender */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GENDER</Text>
            <View style={styles.pillRow}>
              {GENDER_OPTIONS.map(option => {
                const isSelected = draft.gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    onPress={() => selectGender(option.value)}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Gender: ${option.label}`}
                    testID={`filter-gender-${option.label.toLowerCase()}`}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 5: Color */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COLOR</Text>
            <View style={styles.colorGrid}>
              {COLOR_PALETTE.map(color => {
                const isSelected = draft.colors?.includes(color.id);
                return (
                  <TouchableOpacity
                    key={color.id}
                    onPress={() => toggleColor(color.id)}
                    style={[styles.colorChip, isSelected && styles.colorChipSelected]}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Color: ${color.label}`}
                    testID={`filter-color-${color.id}`}
                  >
                    <View
                      style={[styles.colorSwatch, { backgroundColor: color.hex }]}
                    />
                    <Text style={styles.colorLabel}>{color.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 6: Brand */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BRAND</Text>
            <View style={styles.brandInputContainer}>
              <TextInput
                style={styles.brandInput}
                placeholder="Type brand name (min 2 chars)..."
                value={brandQuery}
                onChangeText={handleBrandInputChange}
                onFocus={() => {
                  if (brandSuggestions.length > 0) {
                    setShowBrandDropdown(true);
                  }
                }}
                accessibilityLabel="Brand name input"
                testID="filter-brand-input"
              />
              {showBrandDropdown && (
                <View style={styles.brandDropdown}>
                  {brandSuggestions.map((brand, index) => (
                    <Pressable
                      key={`${brand}-${index}`}
                      onPress={() => selectBrand(brand)}
                      style={styles.brandSuggestion}
                      accessibilityLabel={`Select brand: ${brand}`}
                      testID={`brand-suggestion-${index}`}
                    >
                      <Text style={styles.brandSuggestionText}>{brand}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Section 7: Price Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRICE RANGE</Text>
            <View style={styles.pillRow}>
              {PRICE_PRESETS.map(preset => {
                const isSelected = 
                  draft.minPrice === preset.min && draft.maxPrice === preset.max;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => selectPricePreset(preset)}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Price range: ${preset.label}`}
                    testID={`filter-price-preset-${preset.id}`}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.customPriceLabel}>Custom Range:</Text>
            <View style={styles.priceInputRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                keyboardType="numeric"
                value={draft.minPrice !== undefined ? String(draft.minPrice) : ''}
                onChangeText={setMinPrice}
                accessibilityLabel="Minimum price"
                testID="filter-price-min"
              />
              <Text style={styles.priceToText}>to</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                keyboardType="numeric"
                value={draft.maxPrice !== undefined ? String(draft.maxPrice) : ''}
                onChangeText={setMaxPrice}
                accessibilityLabel="Maximum price"
                testID="filter-price-max"
              />
            </View>
            {priceError && (
              <Text style={styles.priceError} testID="filter-price-error">
                {priceError}
              </Text>
            )}
          </View>

          {/* Section 8: Swap Points Only */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.sectionTitle}>SWAP POINTS ONLY</Text>
              <Switch
                value={draft.spEligibleOnly || false}
                onValueChange={toggleSP}
                accessibilityLabel={`Swap points only ${draft.spEligibleOnly ? 'enabled' : 'disabled'}`}
                testID="filter-sp-toggle"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.applyButton, !canApply && styles.applyButtonDisabled]}
            onPress={handleApply}
            disabled={!canApply}
            accessibilityLabel={canApply ? 'Apply filters' : 'Apply disabled due to errors'}
            testID="filter-modal-apply"
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const COLORS = {
  primary: '#007AFF',
  background: '#FFFFFF',
  border: '#E5E5EA',
  text: '#000000',
  textSecondary: '#8E8E93',
  pillBackground: '#F2F2F7',
  pillSelectedBackground: '#007AFF',
  pillSelectedText: '#FFFFFF',
  error: '#FF3B30',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  clearButton: {
    fontSize: 16,
    color: COLORS.primary,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: {
    backgroundColor: COLORS.pillSelectedBackground,
    borderColor: COLORS.pillSelectedBackground,
  },
  pillText: {
    fontSize: 14,
    color: COLORS.text,
  },
  pillTextSelected: {
    color: COLORS.pillSelectedText,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  colorChip: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    minWidth: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.pillBackground,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  colorLabel: {
    fontSize: 12,
    color: COLORS.text,
  },
  brandInputContainer: {
    position: 'relative',
  },
  brandInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    backgroundColor: COLORS.background,
  },
  brandDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginTop: SPACING.xs,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  brandSuggestion: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandSuggestionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  customPriceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    backgroundColor: COLORS.background,
  },
  priceToText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  priceError: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
});
