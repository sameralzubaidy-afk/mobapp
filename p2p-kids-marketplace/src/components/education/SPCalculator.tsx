// FILE: p2p-kids-marketplace/src/components/education/SPCalculator.tsx
// MODULE-18 EDU-006: SP Calculator widget (reusable across Help, Sell, Checkout)

import React, { useState, useEffect } from 'react';
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
import type { SPCalculation } from '../../types/education';
import type { CategoryWithCount } from '../../services/categoryService';
import { trackEducationEvent } from '../../services/educationAnalyticsService';
import { CategorySelectModal } from '../listing/CategorySelectModal';

interface SPCalculatorProps {
  mode: 'sell' | 'buy';
  defaultCategoryId?: string; // Auto-fill from context (Sell/Checkout)
  defaultPrice?: number; // Auto-fill from item (Checkout)
  readonly?: boolean; // Disable editing (Checkout mode)
  onCalculate?: (result: SPCalculation | null) => void;
  testID?: string;
}

export function SPCalculator({
  mode,
  defaultCategoryId,
  defaultPrice,
  readonly = false,
  onCalculate,
  testID = 'sp-calculator',
}: SPCalculatorProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId || '');
  const [price, setPrice] = useState<string>(defaultPrice?.toFixed(2) || '');
  const [result, setResult] = useState<SPCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Auto-calculate when defaults provided (Checkout mode)
  useEffect(() => {
    if (readonly && defaultCategoryId && defaultPrice) {
      handleCalculate(defaultPrice.toString(), defaultCategoryId);
    }
  }, [readonly, defaultCategoryId, defaultPrice]);

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

  const handleCalculate = async (priceInput?: string, categoryId?: string) => {
    const finalPrice = priceInput || price;
    const finalCategoryId = categoryId || selectedCategoryId;

    const priceNum = parseFloat(finalPrice);
    if (!finalCategoryId || !finalPrice || isNaN(priceNum) || priceNum <= 0) {
      setResult(null);
      onCalculate?.(null);
      return;
    }

    try {
      setLoading(true);
      const calcResult = await calculateSP(priceNum, finalCategoryId, mode);
      setResult(calcResult);
      onCalculate?.(calcResult);

      // Track analytics
      await trackEducationEvent('calculator_use', {
        mode,
        category_id: finalCategoryId,
        item_price_bucket: getPriceBucket(priceNum),
      });
    } catch (error) {
      console.error('[SPCalculator] Calculate error:', error);
      setResult(null);
      onCalculate?.(null);
    } finally {
      setLoading(false);
    }
  };

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
      <Text style={styles.label}>
        {mode === 'sell' ? 'Calculate SP You\'ll Earn' : 'Calculate SP You Can Use'}
      </Text>

      {/* Category Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Category</Text>
        <TouchableOpacity
          style={[styles.categoryButton, readonly && styles.readonlyContainer]}
          onPress={() => {
            if (!readonly) {
              setShowCategoryModal(true);
            }
          }}
          disabled={readonly}
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
          style={[styles.input, readonly && styles.readonlyInput]}
          value={price}
          onChangeText={(text) => {
            if (!readonly) {
              setPrice(text);
            }
          }}
          onBlur={() => {
            if (selectedCategoryId && price) {
              handleCalculate();
            }
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          editable={!readonly}
          testID={`${testID}-price-input`}
          accessibilityLabel="Item price in dollars"
        />
      </View>

      {/* Calculate Button (non-readonly mode) */}
      {!readonly && (
        <TouchableOpacity
          style={[
            styles.calculateButton,
            (!selectedCategoryId || !price) && styles.calculateButtonDisabled,
          ]}
          onPress={() => handleCalculate()}
          disabled={!selectedCategoryId || !price || loading}
          testID={`${testID}-calculate-button`}
          accessibilityRole="button"
          accessibilityLabel="Calculate Swap Points"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.calculateButtonText}>Calculate</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Result Display */}
      {result && (
        <View
          style={styles.resultContainer}
          testID={`${testID}-result`}
          accessibilityLiveRegion="polite"
        >
          {mode === 'sell' && result.mode === 'sell' ? (
            <View style={styles.resultContent}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>You'll earn:</Text>
                <Text style={styles.resultValue}>
                  {result.earn_sp} SP {result.is_bonus && '⭐'}
                </Text>
              </View>
              {result.is_bonus && (
                <Text style={styles.bonusText}>Bonus category! Earns {result.multiplier}× SP</Text>
              )}
            </View>
          ) : result.mode === 'buy' ? (
            <View style={styles.resultContent}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Max SP you can use:</Text>
                <Text style={styles.resultValue}>{result.max_sp_usable} SP</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Cash you'll pay:</Text>
                <Text style={styles.resultValue}>${result.cash_paid.toFixed(2)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Platform fee (10%):</Text>
                <Text style={styles.resultValue}>${result.fee.toFixed(2)}</Text>
              </View>
              <View style={[styles.resultRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total cost:</Text>
                <Text style={styles.totalValue}>${result.total_cost.toFixed(2)}</Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {!result && selectedCategoryId && price && !loading && (
        <Text style={styles.placeholderText} testID={`${testID}-placeholder`}>
          {readonly ? 'Calculating...' : 'Tap Calculate to see results'}
        </Text>
      )}

      <CategorySelectModal
        visible={showCategoryModal}
        categories={categories}
        recent={[]}
        onSelect={(cat) => {
          setSelectedCategoryId(cat.id);
          setShowCategoryModal(false);
          if (price) {
            handleCalculate(price, cat.id);
          }
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
  calculateButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  calculateButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  calculateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resultContent: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
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
    marginTop: 12,
    fontStyle: 'italic',
  },
});
