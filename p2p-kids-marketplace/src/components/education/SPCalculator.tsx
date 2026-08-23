// FILE: p2p-kids-marketplace/src/components/education/SPCalculator.tsx
// MODULE-18 EDU-006: SP Calculator widget (reusable across Help, Sell, Checkout)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getCategoriesWithCounts } from '../../services/categoryService';
import { calculateSP } from '../../services/spCalculatorService';
import type { SPCalculation, SellSPCalculation, BuySPCalculation } from '../../types/education';
import type { CategoryWithCount } from '../../services/categoryService';
import { trackEducationEvent } from '../../services/educationAnalyticsService';
import { CategorySelectModal } from '../listing/CategorySelectModal';
import { BonusCategoryBadge } from './BonusCategoryBadge';

interface SPCalculatorProps {
  mode: 'free' | 'auto' | 'locked';
  initialCategoryId?: string; // Pre-fill category (auto/locked modes)
  initialPrice?: number; // Pre-fill price (locked mode)
  onCalculate?: (sellResult: SPCalculation | null, buyResult: SPCalculation | null) => void;
  testID?: string;
  /**
   * Bump this to re-fetch categories (e.g. on screen focus or pull-to-refresh)
   * so an admin's multiplier change is reflected without a full remount.
   * QA: Group Q+S 2026-08-23 Item 3.
   */
  refreshKey?: number;
}

export function SPCalculator({
  mode,
  initialCategoryId,
  initialPrice,
  onCalculate,
  testID = 'sp-calculator',
  refreshKey = 0,
}: SPCalculatorProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || '');
  const [price, setPrice] = useState<string>(initialPrice?.toFixed(2) || '');
  const [sellResult, setSellResult] = useState<SellSPCalculation | null>(null);
  const [buyResult, setBuyResult] = useState<BuySPCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAttemptedCalculation, setHasAttemptedCalculation] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const isEditable = mode !== 'locked';

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const cats = await getCategoriesWithCounts(false);
      setCategories(cats);
    } catch (error) {
      console.error('[SPCalculator] Load categories error:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCalculate = useCallback(
    async (priceInput: string, categoryId: string) => {
      const priceNum = parseFloat(priceInput);
      if (!categoryId || !priceInput || isNaN(priceNum) || priceNum <= 0 || priceNum > 10000) {
        setSellResult(null);
        setBuyResult(null);
        setHasAttemptedCalculation(false);
        onCalculate?.(null, null);
        return;
      }

      try {
        setLoading(true);
        // Calculate BOTH sell and buy simultaneously
        const [sellCalc, buyCalc] = await Promise.all([
          calculateSP(priceNum, categoryId, 'sell'),
          calculateSP(priceNum, categoryId, 'buy'),
        ]);

        // Type narrowing: sellCalc is SellSPCalculation, buyCalc is BuySPCalculation
        setSellResult(sellCalc as SellSPCalculation | null);
        setBuyResult(buyCalc as BuySPCalculation | null);
        onCalculate?.(sellCalc, buyCalc);
        setHasAttemptedCalculation(true);

        // Fire-and-forget analytics to avoid blocking UI rendering.
        void trackEducationEvent('calculator_use', {
          mode,
          category_id: categoryId,
          price_bucket: getPriceBucket(priceNum),
        });
      } catch (error) {
        console.error('[SPCalculator] Calculate error:', error);
        setSellResult(null);
        setBuyResult(null);
        setHasAttemptedCalculation(true);
        onCalculate?.(null, null);
      } finally {
        setLoading(false);
      }
    },
    [mode, onCalculate]
  );

  // Load categories on mount, and re-fetch when refreshKey changes (screen
  // focus / pull-to-refresh) so admin rate changes are picked up without a
  // full remount. QA: Group Q+S 2026-08-23 Item 3.
  useEffect(() => {
    loadCategories();
  }, [refreshKey]);

  // Auto-calculate when locked mode with initial values
  useEffect(() => {
    if (mode === 'locked' && initialCategoryId && initialPrice) {
      void handleCalculate(initialPrice.toString(), initialCategoryId);
    }
  }, [mode, initialCategoryId, initialPrice, handleCalculate]);

  // Live-calculation for editable modes (free/auto)
  useEffect(() => {
    if (!isEditable) {
      return;
    }

    if (!selectedCategoryId || !price) {
      setSellResult(null);
      setBuyResult(null);
      setHasAttemptedCalculation(false);
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0 || priceNum > 10000) {
      setSellResult(null);
      setBuyResult(null);
      setHasAttemptedCalculation(false);
      return;
    }

    // Clear stale data while recomputing new input values.
    setSellResult(null);
    setBuyResult(null);
    setHasAttemptedCalculation(false);

    const timeout = setTimeout(() => {
      void handleCalculate(price, selectedCategoryId);
    }, 200);

    return () => clearTimeout(timeout);
  }, [isEditable, selectedCategoryId, price, handleCalculate]);

  const getPriceBucket = (price: number): string => {
    if (price < 10) return '<10';
    if (price <= 50) return '10-50';
    if (price <= 100) return '50-100';
    return '>100';
  };

  // Only block on the FIRST load. On refreshKey re-fetches keep the existing
  // data visible (no spinner flash) and swap in the fresh rates when they land.
  if (loadingCategories && categories.length === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <ActivityIndicator size="small" color="#5DBB8E" testID={`${testID}-loading`} />
      </View>
    );
  }

  const selectedCategory = categories.find((cat) => cat.id === selectedCategoryId);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>Calculate Your Swap Points</Text>

      {/* Category Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Category</Text>
        <TouchableOpacity
          accessible
          style={[styles.categoryButton, !isEditable && styles.readonlyContainer]}
          onPress={() => {
            if (isEditable) {
              setShowCategoryModal(true);
            }
          }}
          disabled={!isEditable}
          testID={`${testID}-category-picker`}
          accessibilityLabel="Category"
          accessibilityRole="button"
        >
          <Text
            style={[styles.categoryButtonText, !selectedCategory && styles.categoryPlaceholder]}
          >
            {selectedCategory ? selectedCategory.name : 'Select a category'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Price Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Item Price ($)</Text>
        <TextInput
          style={[styles.input, !isEditable && styles.readonlyInput]}
          value={price}
          onChangeText={(text) => {
            if (isEditable) {
              // Enforce 0-10000 with 2 decimals
              const num = parseFloat(text);
              if (text === '' || (!isNaN(num) && num >= 0 && num <= 10000)) {
                setPrice(text);
              }
            }
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          editable={isEditable}
          testID={`${testID}-price-input`}
          accessibilityLabel="Item price, currency"
        />
      </View>

      {/* Results Display - BOTH sell and buy panels */}
      {selectedCategoryId && price && (sellResult || buyResult) ? (
        <View
          style={styles.resultsContainer}
          testID={`${testID}-results`}
          accessibilityLiveRegion="polite"
        >
          {/* Sell Panel */}
          {sellResult && (
            <View style={styles.resultPanel} testID={`${testID}-sell-panel`}>
              <Text style={styles.panelTitle}>If You Sell:</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>You'll earn:</Text>
                <View style={styles.resultValueContainer}>
                  <Text style={styles.resultValue}>{sellResult.earn_sp} SP</Text>
                  {sellResult.is_bonus && (
                    <BonusCategoryBadge
                      iconUrl={selectedCategory?.bonus_badge_icon_url}
                      testID={`${testID}-sell-bonus-badge`}
                    />
                  )}
                </View>
              </View>
              {sellResult.is_bonus && (
                <Text style={styles.bonusText}>
                  Bonus category! Earns {sellResult.multiplier}× SP
                </Text>
              )}
            </View>
          )}

          {/* Buy Panel */}
          {buyResult && (
            <View style={styles.resultPanel} testID={`${testID}-buy-panel`}>
              <Text style={styles.panelTitle}>If You Buy:</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Max SP you can use:</Text>
                <Text style={styles.resultValue}>{buyResult.max_sp_usable} SP</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Cash you'll pay after SP:</Text>
                <Text style={styles.resultValue}>${buyResult.cash_paid.toFixed(2)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Platform fee:</Text>
                <Text style={styles.resultValue}>${buyResult.fee.toFixed(2)}</Text>
              </View>
              <View style={[styles.resultRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total cost:</Text>
                <Text style={styles.totalValue}>${buyResult.total_cost.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>
      ) : loading && selectedCategoryId && price ? (
        <Text style={styles.placeholderText} testID={`${testID}-placeholder`}>
          Calculating...
        </Text>
      ) : !loading && !selectedCategoryId ? (
        <Text style={styles.placeholderText} testID={`${testID}-empty-state`}>
          Select a category to see your SP
        </Text>
      ) : !loading && selectedCategoryId && !price ? (
        <Text style={styles.placeholderText} testID={`${testID}-price-hint`}>
          Enter a price to calculate
        </Text>
      ) : !loading && selectedCategoryId && price && hasAttemptedCalculation ? (
        <Text style={styles.errorText} testID={`${testID}-calc-error`}>
          Unable to calculate right now. Try another category or price.
        </Text>
      ) : null}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#5DBB8E" />
        </View>
      )}

      <CategorySelectModal
        visible={showCategoryModal}
        categories={categories}
        recent={[]}
        onSelect={(cat) => {
          setSelectedCategoryId(cat.id);
          setShowCategoryModal(false);
        }}
        onSelectOther={() => {
          setShowCategoryModal(false);
        }}
        onClose={() => setShowCategoryModal(false)}
        testID={`${testID}-category-modal`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B6B',
    marginBottom: 6,
  },
  categoryButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readonlyContainer: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  categoryButtonText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  categoryPlaceholder: {
    color: '#999999',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
  },
  readonlyInput: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    color: '#999999',
  },
  resultsContainer: {
    marginTop: 16,
    gap: 12,
  },
  resultPanel: {
    backgroundColor: '#F0FAF5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C5E8D5',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  resultLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    flex: 1,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  resultValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bonusText: {
    fontSize: 12,
    color: '#5DBB8E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#C5E8D5',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5DBB8E',
  },
  placeholderText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
});
