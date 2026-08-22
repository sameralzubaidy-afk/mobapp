/**
 * File: p2p-kids-marketplace/src/components/molecules/SearchFilterModal.tsx
 * MODULE-15.1-UI-REDESIGN: Search Filter Modal
 * Task: FLOW-06 Discovery & Search - Filter Modal
 *
 * Redesigned with Whisk design system:
 * - Drag handle at top
 * - FunnelSimple icon in header
 * - Selected chips: #5DBB8E bg, white text
 * - Unselected chips: #F0F0F0 bg, #6B6B6B text
 * - Apply button: sticky green pill (52px)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Pressable,
} from 'react-native';
import { FunnelSimple, Coins, CaretDown } from 'phosphor-react-native';
import { DiscoveryFilters, COLOR_PALETTE, PRICE_PRESETS } from '@/types/discovery';
import { getDefaultFilters, validatePriceRange, countActiveFilters } from '@/utils/filterHelpers';
import { getBrandSuggestions } from '@/services/brandAutocomplete';
import { countListings } from '@/services/discovery';
import { ds, dsRadii, dsType } from '@/theme/discoveryTokens';
import RadiusSlider from '@/components/RadiusSlider';

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
  zipCodeInput: string;
  appliedZipCode: string;
  radiusMiles: number;
  minRadiusMiles: number;
  maxRadiusMiles: number;
  locationLoading: boolean;
  inactiveZipMessage: string | null;
  waitlistMessage: string | null;
  userProfileZip: string;
  /** Current applied search query (used for the live result count). Optional (default ''). */
  currentQuery?: string;
  /** Live "Accepts Swap Points" state — shared with the Discover header chip. */
  spEligibleOnly?: boolean;
  /** Toggle the shared SP filter immediately (applies without tapping Apply). */
  onSpToggle?: (value: boolean) => void;
  onZipCodeInputChange: (value: string) => void;
  onRadiusChange: (nextRadius: number) => void;
  onRadiusComplete: (nextRadius: number) => Promise<void>;
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
  zipCodeInput,
  appliedZipCode,
  radiusMiles,
  minRadiusMiles,
  maxRadiusMiles,
  locationLoading,
  inactiveZipMessage: _inactiveZipMessage,
  waitlistMessage: _waitlistMessage,
  userProfileZip,
  currentQuery = '',
  spEligibleOnly = false,
  onSpToggle = () => {},
  onZipCodeInputChange,
  onRadiusChange,
  onRadiusComplete,
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

  // DISCOVER-REDESIGN: live result count + "More Filters" disclosure state
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  // Resync the draft from the applied filters ONLY when the sheet first opens.
  // Group M P2: the SP toggle is a LIVE filter (shared with the Discover header
  // chip via onSpToggle) — a `filters` change while the sheet is open must NOT
  // re-sync and wipe in-progress draft selections (category/age-group/etc. the
  // user hasn't applied yet). The latest `filters` are read via a ref so this
  // effect depends only on `visible` (the open transition), never on `filters`.
  const wasVisibleRef = useRef(false);
  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) {
      // Sheet already open — don't re-sync (the live SP toggle must not wipe the draft).
      return;
    }
    wasVisibleRef.current = true;
    const openedWith = latestFiltersRef.current;
    setDraft(openedWith);
    setBrandQuery(openedWith.brand || '');
    setPriceError(null);
  }, [visible]);

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

  // DISCOVER-REDESIGN: debounced live result count for the "Show {n} Results"
  // Apply button. Counts the current draft filters + the LIVE shared SP toggle.
  useEffect(() => {
    if (!visible) {
      return;
    }

    setCountLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const total = await countListings(currentQuery, { ...draft, spEligibleOnly });
        setLiveCount(total);
      } catch (err) {
        console.warn('[SearchFilterModal] countListings failed:', err);
        setLiveCount(null);
      } finally {
        setCountLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [visible, currentQuery, draft, spEligibleOnly]);

  const handleClearAll = useCallback(() => {
    setDraft(getDefaultFilters());
    setBrandQuery('');
    setPriceError(null);
    // Re-populate user's profile ZIP when resetting
    onZipCodeInputChange(userProfileZip);
    // Reset the LIVE shared SP toggle too (it applies immediately)
    onSpToggle(false);
  }, [userProfileZip, onZipCodeInputChange, onSpToggle]);

  const handleApply = useCallback(() => {
    if (priceError) {
      return; // Don't apply if validation fails
    }
    onApply(draft);
    onClose();
  }, [draft, priceError, onApply, onClose]);

  const toggleCategory = useCallback((categoryId: string) => {
    setDraft((prev) => {
      const currentIds = prev.categoryIds || [];
      const isSelected = currentIds.includes(categoryId);

      return {
        ...prev,
        categoryIds: isSelected
          ? currentIds.filter((id) => id !== categoryId)
          : [...currentIds, categoryId],
      };
    });
  }, []);

  const selectCondition = useCallback((condition: (typeof CONDITION_OPTIONS)[number]['value']) => {
    setDraft((prev) => ({
      ...prev,
      condition: prev.condition === condition ? undefined : condition,
    }));
  }, []);

  const selectAgeGroup = useCallback((ageGroup: (typeof AGE_GROUP_OPTIONS)[number]['value']) => {
    setDraft((prev) => ({
      ...prev,
      ageGroup: prev.ageGroup === ageGroup ? undefined : ageGroup,
    }));
  }, []);

  const selectGender = useCallback((gender: (typeof GENDER_OPTIONS)[number]['value']) => {
    setDraft((prev) => ({
      ...prev,
      gender: prev.gender === gender ? undefined : gender,
    }));
  }, []);

  const toggleColor = useCallback((colorId: string) => {
    setDraft((prev) => {
      const currentColors = prev.colors || [];
      const isSelected = currentColors.includes(colorId);

      return {
        ...prev,
        colors: isSelected
          ? currentColors.filter((c) => c !== colorId)
          : [...currentColors, colorId],
      };
    });
  }, []);

  const selectBrand = useCallback((brand: string) => {
    setDraft((prev) => ({ ...prev, brand }));
    setBrandQuery(brand);
    setShowBrandDropdown(false);
  }, []);

  const handleBrandInputChange = useCallback((text: string) => {
    setBrandQuery(text);
    setDraft((prev) => ({ ...prev, brand: text || undefined }));
  }, []);

  const selectPricePreset = useCallback((preset: (typeof PRICE_PRESETS)[number]) => {
    setDraft((prev) => ({
      ...prev,
      minPrice: preset.min,
      maxPrice: preset.max,
    }));
  }, []);

  const setMinPrice = useCallback((text: string) => {
    const value = text ? parseFloat(text) : undefined;
    setDraft((prev) => ({ ...prev, minPrice: value }));
  }, []);

  const setMaxPrice = useCallback((text: string) => {
    const value = text ? parseFloat(text) : undefined;
    setDraft((prev) => ({ ...prev, maxPrice: value }));
  }, []);

  // DISCOVER-REDESIGN: the SP toggle is a LIVE filter (shared with the Discover
  // header chip via onSpToggle), so it is deliberately NOT part of the draft.
  // Include it in the count so the sheet's active-filter badge stays accurate.
  const activeCount = countActiveFilters({ ...draft, spEligibleOnly });
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
        {/* Drag handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <FunnelSimple size={20} color="#1A1A1A" weight="regular" />
            <Text style={styles.headerTitle}>Filters {activeCount > 0 && `(${activeCount})`}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close filter modal"
              testID="filter-modal-close"
              style={styles.headerButton}
            >
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearAll}
              accessibilityLabel="Reset all filters"
              testID="filter-modal-reset"
              style={styles.headerButton}
            >
              <Text style={styles.resetButton}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* DISCOVER-REDESIGN: Accepts Swap Points toggle — at the very top, above
              Location. Bound to the SHARED spEligibleOnly (applies immediately,
              synced with the Discover header chip — NOT part of the draft). */}
          <View style={styles.spToggleCard} testID="filter-sp-toggle-card">
            <View style={styles.spToggleIconWrap}>
              <Coins size={20} color={ds.sp[500]} weight="fill" />
            </View>
            <View style={styles.spToggleBody}>
              <Text style={styles.spToggleTitle}>💰 Accepts Swap Points</Text>
              <Text style={styles.spToggleHelper}>Show items sellers will trade for SP + cash</Text>
            </View>
            <Switch
              value={spEligibleOnly}
              onValueChange={onSpToggle}
              trackColor={{ false: ds.neutral[300], true: ds.sp[500] }}
              thumbColor={ds.neutral.white}
              accessibilityLabel={`Accepts Swap Points ${spEligibleOnly ? 'enabled' : 'disabled'}`}
              testID="filter-sp-toggle"
            />
          </View>

          {/* Section 1: Location (ZIP + Radius) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LOCATION</Text>

            <View style={styles.locationInputsRow}>
              <TextInput
                style={styles.locationZipInput}
                placeholder="ZIP code"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
                maxLength={5}
                value={zipCodeInput}
                onChangeText={onZipCodeInputChange}
                accessibilityLabel="ZIP code"
                testID="filter-location-zip-input"
              />
            </View>

            <Text style={styles.locationSummaryText}>
              {zipCodeInput !== appliedZipCode && /^\d{5}$/.test(zipCodeInput)
                ? `ZIP ${zipCodeInput} will apply when you tap Apply Filters.`
                : /^\d{5}$/.test(appliedZipCode)
                  ? `Showing items around ZIP ${appliedZipCode} within ${radiusMiles} miles`
                  : 'No location filter applied. Showing all items.'}
            </Text>

            <View style={styles.radiusSliderWrapper}>
              <RadiusSlider
                value={radiusMiles}
                minRadius={minRadiusMiles}
                maxRadius={maxRadiusMiles}
                onValueChange={onRadiusChange}
                onSlidingComplete={onRadiusComplete}
                loading={locationLoading}
              />
            </View>
          </View>

          {/* Section 1: Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CATEGORY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {categories.map((category) => {
                const isSelected = !!draft.categoryIds?.includes(category.id);
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

          {/* Section: Age Group — always expanded */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AGE GROUP</Text>
            <View style={styles.pillRow}>
              {AGE_GROUP_OPTIONS.map((option) => {
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

          {/* DISCOVER-REDESIGN: More Filters — collapsed by default */}
          <View style={styles.moreFiltersSection}>
            <Pressable
              style={styles.moreFiltersHeader}
              onPress={() => setMoreFiltersOpen((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreFiltersOpen }}
              testID="filter-more-filters-toggle"
            >
              <Text style={styles.moreFiltersTitle}>
                More Filters (Condition, Gender, Color, Brand, Price Range)
              </Text>
              <CaretDown
                size={16}
                color={ds.neutral[700]}
                weight="bold"
                style={{ transform: [{ rotate: moreFiltersOpen ? '180deg' : '0deg' }] }}
              />
            </Pressable>

            {moreFiltersOpen && (
              <View style={styles.moreFiltersBody}>
                {/* Section: Condition (inside More Filters) */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>CONDITION</Text>
                  <View style={styles.pillRow}>
                    {CONDITION_OPTIONS.map((option) => {
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

                {/* Section 5: Gender */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>GENDER</Text>
                  <View style={styles.pillRow}>
                    {GENDER_OPTIONS.map((option) => {
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

                {/* Section 6: Color */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>COLOR</Text>
                  <View style={styles.colorGrid}>
                    {COLOR_PALETTE.map((color) => {
                      const isSelected = !!draft.colors?.includes(color.id);
                      return (
                        <TouchableOpacity
                          key={color.id}
                          onPress={() => toggleColor(color.id)}
                          style={[styles.colorChip, isSelected && styles.colorChipSelected]}
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`Color: ${color.label}`}
                          testID={`filter-color-${color.id}`}
                        >
                          <View style={[styles.colorSwatch, { backgroundColor: color.hex }]} />
                          <Text style={styles.colorLabel}>{color.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section 7: Brand */}
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

                {/* Section 8: Price Range */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>PRICE RANGE</Text>
                  <View style={styles.pillRow}>
                    {PRICE_PRESETS.map((preset) => {
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
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.applyButton, !canApply && styles.applyButtonDisabled]}
            onPress={handleApply}
            disabled={!canApply}
            accessibilityLabel={
              canApply ? `Show ${liveCount ?? 0} results` : 'Apply disabled due to errors'
            }
            testID="filter-modal-apply"
          >
            <Text style={styles.applyButtonText}>
              {countLoading && liveCount === null
                ? 'Calculating…'
                : `Show ${liveCount ?? 0} Results`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const COLORS = {
  primary: '#5DBB8E',
  background: '#FFFFFF',
  border: '#F0F0F0',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#999999',
  pillBackground: '#F0F0F0',
  pillSelectedBackground: '#5DBB8E',
  pillSelectedText: '#FFFFFF',
  error: '#E85D75',
  inputFill: '#F0F0F0',
  dragHandle: '#E0E0E0',
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
    backgroundColor: ds.neutral.white,
    // 20px top-corner radius — design-system §6.4 Bottom Sheet Modal
    borderTopLeftRadius: dsRadii.xlarge,
    borderTopRightRadius: dsRadii.xlarge,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  dragHandle: {
    width: 32, // §6.4: 32×4 grey pill
    height: 4,
    borderRadius: 2,
    backgroundColor: ds.neutral[300],
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerButton: {
    paddingHorizontal: 4,
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  resetButton: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
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
  locationInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationZipInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: COLORS.inputFill,
    color: COLORS.text,
  },
  locationSummaryText: {
    marginTop: SPACING.sm,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  radiusSliderWrapper: {
    marginTop: SPACING.sm,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waitlistBanner: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
  },
  waitlistBannerTitle: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  waitlistBannerSubtitle: {
    marginTop: SPACING.xs,
    fontSize: 12,
    color: '#2563EB',
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.pillBackground,
  },
  pillSelected: {
    backgroundColor: COLORS.pillSelectedBackground,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  pillTextSelected: {
    fontSize: 14,
    fontWeight: '500',
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: COLORS.inputFill,
    color: COLORS.text,
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
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  applyButton: {
    backgroundColor: ds.primary[500],
    borderRadius: dsRadii.medium, // 12 — buttons/inputs (design-system)
    height: 56, // Primary Button, 56px height
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: ds.neutral[500],
    opacity: 0.5,
  },
  applyButtonText: {
    ...dsType.button, // Button (16/24/600/+0.5) — design-system §3.2
    color: ds.neutral.white,
  },
  // DISCOVER-REDESIGN: Accepts Swap Points toggle card (SP-gold tokens)
  spToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 16,
    backgroundColor: ds.sp[100],
    borderWidth: 1,
    borderColor: ds.sp[500],
    borderRadius: dsRadii.large, // 16 — cards
  },
  spToggleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ds.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spToggleBody: {
    flex: 1,
  },
  spToggleTitle: {
    ...dsType.body,
    fontWeight: '600',
    color: ds.neutral[900],
  },
  spToggleHelper: {
    ...dsType.bodySmall,
    color: ds.neutral[700],
    marginTop: 2,
  },
  // DISCOVER-REDESIGN: More Filters collapsible
  moreFiltersSection: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  moreFiltersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  moreFiltersTitle: {
    ...dsType.body,
    fontWeight: '600',
    color: ds.neutral[900],
    flex: 1,
    marginRight: 8,
  },
  moreFiltersBody: {
    paddingBottom: 8,
  },
});
