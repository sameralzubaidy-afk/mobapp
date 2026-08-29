/**
 * File: p2p-kids-marketplace/src/components/listing/PriceSuggestionCard.tsx
 * MODULE-04 LISTING-V3-008: Price Suggestion Card
 * Task: LISTING-V3-008 - 4-tier price suggestions + manual input
 * Updated: ADMIN-V3-007 - Add SP earning/spending preview
 *
 * Features:
 * - 4 price tier cards (great_deal, fair_price, asking_price, almost_new)
 * - Manual price input option
 * - SP earning and spending preview (MODULE-12 V3)
 * - Show manual-only when no suggestions available
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PriceTier, PriceSuggestion } from '../../types/listing';
import { calculateCategorySP } from '../../services/categoryService';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export interface PriceSuggestionCardProps {
  tiers: PriceSuggestion[];
  selectedTier: PriceTier | null;
  manualValue: string;
  onSelectTier: (tier: PriceTier) => void;
  onChangeManual: (value: string) => void;
  onShowFaq?: () => void;
  /** Category ID for SP calculation */
  categoryId?: string;
  testID?: string;
}

export function PriceSuggestionCard({
  tiers,
  selectedTier,
  manualValue,
  onSelectTier,
  onChangeManual,
  onShowFaq,
  categoryId,
  testID = 'price-suggestion-card',
}: PriceSuggestionCardProps) {
  const hasSuggestions = tiers.length > 0;

  // State for SP calculation
  const [spPreview, setSPPreview] = useState<{
    earn_sp: number;
    max_spend_sp: number;
  } | null>(null);
  const [loadingSP, setLoadingSP] = useState(false);

  // Calculate SP preview when category or price changes
  useEffect(() => {
    const fetchSPPreview = async () => {
      if (!categoryId) {
        setSPPreview(null);
        return;
      }

      // Get the current price from either selected tier or manual input
      const selectedPrice = selectedTier
        ? tiers.find((t) => t.tier === selectedTier)?.price
        : parseFloat(manualValue);

      if (!selectedPrice || isNaN(selectedPrice) || selectedPrice <= 0) {
        setSPPreview(null);
        return;
      }

      setLoadingSP(true);
      try {
        const result = await calculateCategorySP(categoryId, selectedPrice);
        if (result) {
          setSPPreview({
            earn_sp: result.earn_sp,
            max_spend_sp: result.max_spend_sp,
          });
        } else {
          setSPPreview(null);
        }
      } catch (error) {
        console.error('[PriceSuggestionCard] SP calculation error:', error);
        setSPPreview(null);
      } finally {
        setLoadingSP(false);
      }
    };

    fetchSPPreview();
  }, [categoryId, selectedTier, manualValue, tiers]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>Price</Text>
        {onShowFaq && (
          <TouchableOpacity
            onPress={onShowFaq}
            accessibilityLabel="Show pricing FAQ"
            accessibilityRole="button"
            testID="pricing-faq"
            accessible
          >
            <Text style={styles.faqButton}>?</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SP Preview (MODULE-12 V3) */}
      {spPreview && !loadingSP && (
        <View style={styles.spPreviewContainer} testID="sp-preview">
          <View style={styles.spPreviewRow}>
            <Text style={styles.spPreviewLabel}>You'll earn:</Text>
            <Text style={styles.spPreviewValue}>{spPreview.earn_sp} SP</Text>
          </View>
          <View style={styles.spPreviewRow}>
            <Text style={styles.spPreviewLabel}>Buyer can use up to:</Text>
            <Text style={styles.spPreviewValue}>{spPreview.max_spend_sp} SP</Text>
          </View>
        </View>
      )}
      {loadingSP && (
        <View style={styles.spLoadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.spLoadingText}>Calculating SP...</Text>
        </View>
      )}

      {hasSuggestions ? (
        <>
          <Text style={styles.subtitle}>Suggested pricing based on similar items:</Text>

          <View style={styles.tiersContainer}>
            {tiers.map((tier) => {
              const isSelected = selectedTier === tier.tier;

              return (
                <TouchableOpacity
                  accessible
                  key={tier.tier}
                  style={[styles.tierCard, isSelected && styles.tierCardSelected]}
                  onPress={() => onSelectTier(tier.tier)}
                  accessibilityLabel={`${tier.label}: $${tier.price.toFixed(2)}`}
                  accessibilityHint={tier.description}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  testID={`tier-${tier.tier}`}
                >
                  <Text style={[styles.tierLabel, isSelected && styles.tierLabelSelected]}>
                    {tier.label}
                  </Text>
                  <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                    ${tier.price.toFixed(2)}
                  </Text>
                  <Text
                    style={[styles.tierDescription, isSelected && styles.tierDescriptionSelected]}
                  >
                    {tier.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
        </>
      ) : (
        <Text style={styles.noSuggestionsText}>
          Not enough data to suggest pricing. Set your price below.
        </Text>
      )}

      <View style={styles.manualInputContainer}>
        <Text style={styles.manualLabel}>Set custom price</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            style={styles.input}
            value={manualValue}
            onChangeText={onChangeManual}
            placeholder="0.00"
            keyboardType="decimal-pad"
            maxLength={10}
            accessibilityLabel="Manual price input"
            testID="manual-price-input"
          />
        </View>
      </View>
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
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  faqButton: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#007AFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  tiersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tierCard: {
    width: '48%',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F5F5F5',
  },
  tierCardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  tierLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  tierLabelSelected: {
    color: '#007AFF',
  },
  tierPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  tierPriceSelected: {
    color: '#007AFF',
  },
  tierDescription: {
    fontSize: 12,
    color: '#666666',
  },
  tierDescriptionSelected: {
    color: '#0066CC',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#999999',
    fontWeight: '500',
  },
  noSuggestionsText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
    paddingVertical: 12,
  },
  spPreviewContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  spPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  spPreviewLabel: {
    fontSize: 14,
    color: '#0066CC',
  },
  spPreviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066CC',
  },
  spLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
  },
  spLoadingText: {
    fontSize: 14,
    color: '#666666',
  },
  manualInputContainer: {
    marginTop: 8,
  },
  manualLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    paddingVertical: 12,
  },
});
