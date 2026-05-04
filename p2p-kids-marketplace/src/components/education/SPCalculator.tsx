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
}

export function SPCalculator({
  mode,
  initialCategoryId,
  initialPrice,
  onCalculate,
  testID = 'sp-calculator',
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

  const handleCalculate = useCallback(async (priceInput: string, categoryId: string) => {
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
  }, [mode, onCalculate]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

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

  if (loadingCategories) {
    return (
      <View style={styles.container} testID={testID}>
        <ActivityIndicator size="small" color="#3B82F6" testID={`${testID}-loading`} />
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
          <Text style={[styles.categoryButtonText, !selectedCategory && styles.categoryPlaceholder]}>
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
          <ActivityIndicator size="small" color="#3B82F6" />
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
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 6,
  },
  categoryButton: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readonlyContainer: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#1F2937',
  },
  categoryPlaceholder: {
    color: '#9CA3AF',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  readonlyInput: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    color: '#6B7280',
  },
  resultsContainer: {
    marginTop: 16,
    gap: 12,
  },
  resultPanel: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
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
    color: '#4B5563',
    flex: 1,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  resultValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bonusText: {
    fontSize: 12,
    color: '#3B82F6',
    fontStyle: 'italic',
    marginTop: 4,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
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
